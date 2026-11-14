import 'package:flutter/material.dart';

/// Warm palette shared with the website.
class AyojonColors {
  static const brown = Color(0xFF856246);
  static const ink = Color(0xFF3D2F24);
  static const cream = Color(0xFFFCFAF5);
  static const sand = Color(0xFFEADFCF);
  static const rose = Color(0xFFB3261E);
  static const sage = Color(0xFF2F5D2A);
}

ThemeData ayojonTheme() {
  final scheme = ColorScheme.fromSeed(seedColor: AyojonColors.brown, surface: AyojonColors.cream);
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: AyojonColors.cream,
    appBarTheme: const AppBarTheme(backgroundColor: AyojonColors.cream, foregroundColor: AyojonColors.ink, elevation: 0, centerTitle: false),
    cardTheme: CardThemeData(
      color: Colors.white,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: AyojonColors.sand)),
      margin: const EdgeInsets.symmetric(vertical: 6),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AyojonColors.sand)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AyojonColors.sand)),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
    ),
  );
}
