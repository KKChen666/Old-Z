class ModelConfig {
  const ModelConfig({
    required this.modelId,
    required this.displayName,
    this.modelTypes = const ['chat'],
    this.inputModes = const ['text'],
    this.capabilities = const [],
  });

  final String modelId;
  final String displayName;
  final List<String> modelTypes;
  final List<String> inputModes;
  final List<String> capabilities;

  String get fimMode =>
      modelTypes.contains('completion') ? 'completions' : 'none';

  factory ModelConfig.fromJson(Map<String, Object?> json) {
    final modelId = json['modelId']?.toString() ?? '';
    return ModelConfig(
      modelId: modelId,
      displayName: json['displayName']?.toString() ?? modelId,
      modelTypes: _readModelTypes(json),
      inputModes: _readStringList(json['inputModes'], const ['text']),
      capabilities: _readStringList(json['capabilities'], const []),
    );
  }

  Map<String, Object?> toJson() {
    return {
      'modelId': modelId,
      'displayName': displayName,
      'modelTypes': modelTypes,
      'inputModes': inputModes,
      'capabilities': capabilities,
    };
  }

  ModelConfig copyWith({
    String? modelId,
    String? displayName,
    List<String>? modelTypes,
    List<String>? inputModes,
    List<String>? capabilities,
  }) {
    return ModelConfig(
      modelId: modelId ?? this.modelId,
      displayName: displayName ?? this.displayName,
      modelTypes: modelTypes ?? this.modelTypes,
      inputModes: inputModes ?? this.inputModes,
      capabilities: capabilities ?? this.capabilities,
    );
  }

  static List<String> _readStringList(Object? value, List<String> fallback) {
    if (value is! List) {
      return fallback;
    }
    return value.map((item) => item.toString()).toList();
  }

  static List<String> _readModelTypes(Map<String, Object?> json) {
    final modelTypes = _readStringList(json['modelTypes'], const ['chat']);
    if (json['fimMode']?.toString() == 'completions' &&
        !modelTypes.contains('completion')) {
      return [...modelTypes, 'completion'];
    }
    return modelTypes;
  }
}
