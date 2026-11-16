# Flutter and Firebase ship their own consumer rules. Keep Firebase entry points
# used by reflection when optional push messaging is configured.
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**
