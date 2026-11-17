import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import 'config.dart';
import 'providers.dart';

/// One Socket.IO connection per signed-in session, authenticated with the
/// current access token (refreshed tokens are picked up on reconnect).
final socketProvider = Provider<io.Socket?>((ref) {
  final user = ref.watch(currentUserProvider);
  if (user == null) return null;
  final api = ref.read(apiProvider);
  final socket = io.io(
    AppConfig.socketUrl,
    io.OptionBuilder().setTransports(['websocket']).disableAutoConnect().setAuthFn((callback) async {
      try {
        final result = await api.get<Map<String, dynamic>>('auth/socket-token');
        callback({'token': result['token']});
      } catch (_) {
        callback({});
      }
    }).build(),
  );
  Timer? retry;
  socket.onConnectError((_) {
    retry?.cancel();
    retry = Timer(const Duration(seconds: 5), socket.connect);
  });
  socket.onConnect((_) => retry?.cancel());
  socket.connect();
  ref.onDispose(() {
    retry?.cancel();
    socket.dispose();
  });
  return socket;
});
