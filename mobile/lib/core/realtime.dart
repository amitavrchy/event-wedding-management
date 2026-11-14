import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import 'config.dart';
import 'providers.dart';

/// One Socket.IO connection per signed-in session, authenticated with the
/// current access token (refreshed tokens are picked up on reconnect).
final socketProvider = Provider<io.Socket?>((ref) {
  final user = ref.watch(currentUserProvider);
  if (user == null) return null;
  final tokens = ref.read(tokenStoreProvider);
  final socket = io.io(
    AppConfig.socketUrl,
    io.OptionBuilder().setTransports(['websocket']).disableAutoConnect().setAuthFn((callback) async {
      callback({'token': await tokens.access()});
    }).build(),
  );
  socket.connect();
  ref.onDispose(socket.dispose);
  return socket;
});
