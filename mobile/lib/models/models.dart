/// Lightweight models for the screens that need typed data. Less central
/// screens read the JSON maps directly.
typedef Json = Map<String, dynamic>;

T? _as<T>(Object? v) => v is T ? v : null;
DateTime? _date(Object? v) => v is String ? DateTime.tryParse(v)?.toLocal() : null;

class User {
  User({
    required this.id,
    required this.fullName,
    required this.email,
    required this.role,
    this.phone,
    this.locale = 'en',
    this.emailVerified = false,
    this.phoneVerified = false,
    this.twoFactorEnabled = false,
  });
  final String id, fullName, email, role, locale;
  final String? phone;
  final bool emailVerified, phoneVerified, twoFactorEnabled;
  bool get isVendor => role == 'VENDOR';
  bool get isAdmin => role == 'PLATFORM_ADMIN';

  factory User.fromJson(Json j) => User(
        id: j['id'] as String,
        fullName: j['fullName'] as String,
        email: (j['email'] ?? '') as String,
        role: (j['role'] ?? 'HOST') as String,
        phone: _as<String>(j['phone']),
        locale: (j['locale'] ?? 'en') as String,
        emailVerified: j['emailVerified'] == true,
        phoneVerified: j['phoneVerified'] == true,
        twoFactorEnabled: j['twoFactorEnabled'] == true,
      );
}

class OccasionType {
  OccasionType({required this.type, required this.label, required this.labelBn, required this.description, required this.budgetMinor, required this.guestCapacity, required this.features});
  final String type, label, labelBn, description;
  final int budgetMinor, guestCapacity;
  final List<String> features;
  factory OccasionType.fromJson(Json j) => OccasionType(
        type: j['type'] as String,
        label: j['label'] as String,
        labelBn: (j['labelBn'] ?? j['label']) as String,
        description: (j['description'] ?? '') as String,
        budgetMinor: (j['budgetMinor'] ?? 0) as int,
        guestCapacity: (j['guestCapacity'] ?? 50) as int,
        features: List<String>.from((j['features'] ?? const []) as List),
      );
}

class Feature {
  Feature({required this.key, required this.group, required this.label, required this.labelBn, required this.description, required this.path, this.core = false});
  final String key, group, label, labelBn, description, path;
  final bool core;
  factory Feature.fromJson(Json j) => Feature(
        key: j['key'] as String,
        group: j['group'] as String,
        label: j['label'] as String,
        labelBn: j['labelBn'] as String,
        description: (j['description'] ?? '') as String,
        path: j['path'] as String,
        core: j['core'] == true,
      );
}

class FeatureCatalog {
  FeatureCatalog(this.groups, this.features);
  final List<({String key, String label, String labelBn})> groups;
  final List<Feature> features;
  factory FeatureCatalog.fromJson(Json j) => FeatureCatalog(
        [for (final g in j['groups'] as List) (key: g['key'] as String, label: g['label'] as String, labelBn: g['labelBn'] as String)],
        [for (final f in j['features'] as List) Feature.fromJson(f as Json)],
      );
}

class EventDay {
  EventDay({required this.id, required this.name, required this.startsAt, this.venueName});
  final String id, name;
  final DateTime startsAt;
  final String? venueName;
  factory EventDay.fromJson(Json j) =>
      EventDay(id: j['id'] as String, name: j['name'] as String, startsAt: _date(j['startsAt'])!, venueName: _as<String>(j['venueName']));
}

class EventSummary {
  EventSummary({required this.id, required this.title, required this.eventType, required this.features, required this.days, required this.city, required this.guestCapacity, required this.budgetMinor, this.access = 'OWNER', this.raw = const {}});
  final String id, title, eventType, city, access;
  final List<String> features;
  final List<EventDay> days;
  final int guestCapacity, budgetMinor;
  final Json raw;
  bool get readOnly => access == 'VIEWER';
  bool has(String feature) => features.contains(feature);
  factory EventSummary.fromJson(Json j) => EventSummary(
        id: j['id'] as String,
        title: j['title'] as String,
        eventType: (j['eventType'] ?? 'GENERAL') as String,
        city: (j['city'] ?? '') as String,
        access: (j['access'] ?? 'OWNER') as String,
        guestCapacity: (j['guestCapacity'] ?? 0) as int,
        budgetMinor: (j['budgetMinor'] ?? 0) as int,
        features: List<String>.from((j['features'] ?? const []) as List),
        days: [for (final d in (j['days'] ?? const []) as List) EventDay.fromJson(d as Json)]..sort((a, b) => a.startsAt.compareTo(b.startsAt)),
        raw: j,
      );
}

class Guest {
  Guest({required this.id, required this.name, required this.rsvpStatus, required this.partySize, required this.maxPartySize, this.phone, this.side, this.token, this.relationship, this.mealPreference});
  final String id, name, rsvpStatus;
  final int partySize, maxPartySize;
  final String? phone, side, token, relationship, mealPreference;
  factory Guest.fromJson(Json j) => Guest(
        id: j['id'] as String,
        name: j['name'] as String,
        rsvpStatus: (j['rsvpStatus'] ?? 'INVITED') as String,
        partySize: (j['partySize'] ?? 1) as int,
        maxPartySize: (j['maxPartySize'] ?? 1) as int,
        phone: _as<String>(j['phone']),
        side: _as<String>(j['side']),
        token: _as<String>(j['token']),
        relationship: _as<String>(j['relationship']),
        mealPreference: _as<String>(j['mealPreference']),
      );
}

class Vendor {
  Vendor({required this.id, required this.slug, required this.businessName, required this.category, required this.city, required this.description, required this.image, required this.services, this.verified = false, this.sponsored = false, this.ratingAvg = 0, this.ratingCount = 0, this.priceFromMinor, this.responseMinutes});
  final String id, slug, businessName, category, city, description, image;
  final bool verified, sponsored;
  final double ratingAvg;
  final int ratingCount;
  final int? priceFromMinor, responseMinutes;
  final List<Json> services;
  factory Vendor.fromJson(Json j) => Vendor(
        id: j['id'] as String,
        slug: (j['slug'] ?? '') as String,
        businessName: j['businessName'] as String,
        category: (j['category'] ?? '') as String,
        city: (j['city'] ?? '') as String,
        description: (j['description'] ?? '') as String,
        image: (j['image'] ?? '') as String,
        services: List<Json>.from((j['services'] ?? const []) as List),
        verified: j['verified'] == true || j['verifiedAt'] != null,
        sponsored: j['sponsored'] == true,
        ratingAvg: ((j['ratingAvg'] ?? 0) as num).toDouble(),
        ratingCount: (j['ratingCount'] ?? 0) as int,
        priceFromMinor: _as<int>(j['priceFromMinor']),
        responseMinutes: _as<int>(j['responseMinutes']),
      );
}
