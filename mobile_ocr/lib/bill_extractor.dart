/// Structured result from bill OCR. UI uses this; no dependency on raw text.
class BillData {
  final String? invoiceNumber;
  final String? date;
  final String? gst;
  final String? total;
  final ConfidenceLevel? invoiceConfidence;
  final ConfidenceLevel? dateConfidence;
  final ConfidenceLevel? gstConfidence;
  final ConfidenceLevel? totalConfidence;

  BillData({
    this.invoiceNumber,
    this.date,
    this.gst,
    this.total,
    this.invoiceConfidence,
    this.dateConfidence,
    this.gstConfidence,
    this.totalConfidence,
  });

  String get invoiceNumberDisplay => invoiceNumber ?? "Not Found";
  String get dateDisplay => date ?? "Not Found";
  String get gstDisplay => gst ?? "Not Found";
  String get totalDisplay => total ?? "Not Found";

  BillData copyWith({
    String? invoiceNumber,
    String? date,
    String? gst,
    String? total,
    ConfidenceLevel? invoiceConfidence,
    ConfidenceLevel? dateConfidence,
    ConfidenceLevel? gstConfidence,
    ConfidenceLevel? totalConfidence,
  }) {
    return BillData(
      invoiceNumber: invoiceNumber ?? this.invoiceNumber,
      date: date ?? this.date,
      gst: gst ?? this.gst,
      total: total ?? this.total,
      invoiceConfidence: invoiceConfidence ?? this.invoiceConfidence,
      dateConfidence: dateConfidence ?? this.dateConfidence,
      gstConfidence: gstConfidence ?? this.gstConfidence,
      totalConfidence: totalConfidence ?? this.totalConfidence,
    );
  }
}

class _Extracted {
  final String? value;
  final ConfidenceLevel confidence;
  _Extracted(this.value, this.confidence);
}

/// Regex-based extraction across full raw text (no line-by-line parsing).
/// Uses normalized text so OCR line-splits and extra spaces don't break matches.
class BillExtractor {
  /// Clean OCR text before extraction: collapse newlines and multiple spaces.
  static String normalizeText(String text) {
    return text
        .replaceAll('\n\n', '\n')
        .replaceAll(RegExp(r'[ ]+'), ' ')
        .trim();
  }

  /// Single-line version for regex (newlines → space).
  static String _normalize(String text) {
    return text.replaceAll(RegExp(r'\s+'), ' ').trim();
  }

  /// Run all extractors. Normalizes text first, then extracts. Confidence from extraction method.
  static BillData extract(String rawText) {
    final text = normalizeText(rawText);
    final inv = _extractInvoiceNumber(text);
    final date = _extractDate(text);
    final gst = _extractGST(text);
    final total = _extractTotal(text);
    return BillData(
      invoiceNumber: inv.value,
      date: date.value,
      gst: gst.value,
      total: total.value,
      invoiceConfidence: inv.confidence,
      dateConfidence: date.confidence,
      gstConfidence: gst.confidence,
      totalConfidence: total.confidence,
    );
  }

  /// Invoice No: from "No :" or number near "No"/"Date" in header. Fallback: first 3–6 digit number in header (not 33, 446).
  static _Extracted _extractInvoiceNumber(String text) {
    final lines = text.split('\n').map((s) => s.trim()).toList();
    for (var i = 0; i < lines.length; i++) {
      final line = lines[i];
      final noMatch = RegExp(r'No\s*:\s*(\d+)', caseSensitive: false).firstMatch(line);
      if (noMatch != null) {
        final v = noMatch.group(1);
        if (v != null && v.length >= 3 && v.length <= 6) {
          final nextLines = lines.skip(i).take(3).join(' ');
          if (RegExp(r'Date', caseSensitive: false).hasMatch(nextLines)) return _Extracted(v, ConfidenceLevel.high);
          return _Extracted(v, ConfidenceLevel.medium);
        }
      }
      if (RegExp(r'^No\s*:?\s*$', caseSensitive: false).hasMatch(line) && i + 1 < lines.length) {
        final nextNum = RegExp(r'^(\d{3,6})$').firstMatch(lines[i + 1]);
        if (nextNum != null) return _Extracted(nextNum.group(1), ConfidenceLevel.high);
      }
    }
    final n = _normalize(text);
    final noDate = RegExp(r'No\s*:\s*(\d{3,6})\s+.*?Date', caseSensitive: false);
    final m = noDate.firstMatch(n);
    if (m != null) return _Extracted(m.group(1), ConfidenceLevel.high);
    final noOnly = RegExp(r'No\s*:\s*(\d{3,6})', caseSensitive: false);
    final m2 = noOnly.firstMatch(n);
    if (m2 != null) return _Extracted(m2.group(1), ConfidenceLevel.medium);
    final noSpace = RegExp(r'No\s+(\d{3,6})', caseSensitive: false);
    final m3 = noSpace.firstMatch(n);
    if (m3 != null) return _Extracted(m3.group(1), ConfidenceLevel.medium);
    final headerLines = lines.take(20).join(' ');
    final anyNum = RegExp(r'\b(\d{3,6})\b').allMatches(headerLines);
    for (final match in anyNum) {
      final v = match.group(1)!;
      if (v == '33' || v == '446') continue;
      if (v.length >= 5) continue;
      return _Extracted(v, ConfidenceLevel.medium);
    }
    return _Extracted(null, ConfidenceLevel.low);
  }

  /// Date: from "Date :" in header. Fallback: first valid date in first 20 lines (invoice date area).
  static _Extracted _extractDate(String text) {
    final lines = text.split('\n').map((s) => s.trim()).toList();
    final datePattern = RegExp(r'(\d{1,2}/\d{1,2}/\d{4})');
    final headerLimit = lines.length > 25 ? 20 : lines.length;
    for (var i = 0; i < headerLimit; i++) {
      final line = lines[i];
      if (RegExp(r'Date\s*:?', caseSensitive: false).hasMatch(line)) {
        final m = datePattern.firstMatch(line);
        if (m != null && _isValidDate(m.group(1)!)) return _Extracted(m.group(1), ConfidenceLevel.high);
        if (i + 1 < lines.length) {
          final m2 = datePattern.firstMatch(lines[i + 1]);
          if (m2 != null && _isValidDate(m2.group(1)!)) return _Extracted(m2.group(1), ConfidenceLevel.high);
        }
      }
    }
    final n = _normalize(text);
    final dateRegex = RegExp(r'Date\s*:\s*(\d{1,2}/\d{1,2}/\d{4})', caseSensitive: false);
    final m = dateRegex.firstMatch(n);
    if (m != null && _isValidDate(m.group(1)!)) return _Extracted(m.group(1), ConfidenceLevel.high);
    final dateLoose = RegExp(r'Date\s*:?\s*\S*\s*(\d{1,2}/\d{1,2}/\d{4})', caseSensitive: false);
    final m2 = dateLoose.firstMatch(n);
    if (m2 != null && _isValidDate(m2.group(1)!)) return _Extracted(m2.group(1), ConfidenceLevel.medium);
    for (var i = 0; i < headerLimit; i++) {
      final m3 = datePattern.firstMatch(lines[i]);
      if (m3 != null && _isValidDate(m3.group(1)!)) return _Extracted(m3.group(1), ConfidenceLevel.medium);
    }
    return _Extracted(null, ConfidenceLevel.low);
  }

  static bool _isValidDate(String dateStr) {
    final parts = dateStr.split(RegExp(r'[/\-]'));
    if (parts.length != 3) return false;
    final d = int.tryParse(parts[0]);
    final m = int.tryParse(parts[1]);
    final y = int.tryParse(parts[2]);
    if (d == null || m == null || y == null) return false;
    if (d < 1 || d > 31) return false;
    if (m < 1 || m > 12) return false;
    return true;
  }

  /// Seller GSTIN: ONLY from header. Pick GSTIN that appears BEFORE "To" or "To." (buyer section).
  /// Top 25% of document = header. Regex: GSTIN\s*[:\-]?\s*([0-9A-Z]{15})
  static _Extracted _extractGST(String text) {
    if (text.isEmpty) return _Extracted(null, ConfidenceLevel.low);
    final toMatch = RegExp(r'\bTo\.?\b', caseSensitive: false).firstMatch(text);
    final buyerStart = toMatch?.start ?? text.length;
    final headerEnd = (text.length * 0.25).floor().clamp(0, text.length);
    final cutoff = buyerStart < text.length ? buyerStart : headerEnd;

    final gstinKeyword = RegExp(r'GSTIN\s*[:\-]?\s*([0-9A-Z]{15})', caseSensitive: false);
    for (final m in gstinKeyword.allMatches(text)) {
      if (m.start < cutoff) return _Extracted(m.group(1), ConfidenceLevel.high);
    }
    final strict = RegExp(r'\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{3}\b');
    for (final m in strict.allMatches(text)) {
      if (m.start < cutoff) return _Extracted(m.group(0), ConfidenceLevel.high);
    }
    final relaxed = RegExp(r'\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9\s]{3,5}\b');
    for (final m in relaxed.allMatches(text)) {
      if (m.start < cutoff) return _Extracted(m.group(0)!.replaceAll(' ', ''), ConfidenceLevel.medium);
    }
    return _Extracted(null, ConfidenceLevel.low);
  }

  /// Net Total: from "NET TOTAL" line. Fallback: largest amount in last 20 lines (summary section).
  static _Extracted _extractTotal(String text) {
    if (text.isEmpty) return _Extracted(null, ConfidenceLevel.low);
    final amountRegex = RegExp(r'(\d{1,3}(?:,\d{3})*\.\d{2})');
    final amountNoComma = RegExp(r'\b(\d{4,}\.\d{2})\b');
    final lines = text.split('\n').map((s) => s.trim()).toList();
    for (var i = lines.length - 1; i >= 0; i--) {
      final lower = lines[i].toLowerCase();
      if (!lower.contains('net total')) continue;
      final m = RegExp(r'NET\s*TOTAL\s*[\s:]*(\d{1,3}(?:,\d{3})*\.\d{2})', caseSensitive: false).firstMatch(lines[i]);
      if (m != null) return _Extracted(m.group(1), ConfidenceLevel.high);
      final m2 = amountRegex.firstMatch(lines[i]);
      if (m2 != null) return _Extracted(m2.group(1), ConfidenceLevel.high);
      if (i + 1 < lines.length) {
        final m3 = amountRegex.firstMatch(lines[i + 1]);
        if (m3 != null) return _Extracted(m3.group(1), ConfidenceLevel.high);
      }
    }
    final n = _normalize(text);
    final netTotalRegex = RegExp(r'NET\s*TOTAL\s*[\s:]*(\d{1,3}(?:,\d{3})*\.\d{2})', caseSensitive: false);
    final m = netTotalRegex.firstMatch(n);
    if (m != null) return _Extracted(m.group(1), ConfidenceLevel.high);
    final lastLines = lines.length > 25 ? lines.sublist(lines.length - 20) : lines;
    final lastText = lastLines.join(' ');
    double? maxVal;
    String? maxStr;
    for (final match in amountRegex.allMatches(lastText)) {
      final s = match.group(1)!.replaceAll(',', '');
      final v = double.tryParse(s);
      if (v != null && v > 1000 && (maxVal == null || v > maxVal)) {
        maxVal = v;
        maxStr = match.group(1);
      }
    }
    for (final match in amountNoComma.allMatches(lastText)) {
      final v = double.tryParse(match.group(1)!);
      if (v != null && v > 1000 && (maxVal == null || v > maxVal)) {
        maxVal = v;
        maxStr = match.group(1);
      }
    }
    if (maxStr != null) return _Extracted(maxStr, ConfidenceLevel.medium);
    return _Extracted(null, ConfidenceLevel.low);
  }
}

/// Clean raw OCR for display: collapse newlines, remove isolated digit lines.
String cleanText(String text) {
  if (text.isEmpty) return text;
  return text
      .replaceAll(RegExp(r'\n{2,}'), '\n')
      .replaceAllMapped(RegExp(r'^\d+$', multiLine: true), (_) => '')
      .replaceAll(RegExp(r'\n{2,}'), '\n')
      .trim();
}

// --- Phase 2: Confidence tagging ---

enum ConfidenceLevel { high, medium, low }

ConfidenceLevel gstConfidence(String gst) {
  if (gst == "Not Found" || gst.isEmpty) return ConfidenceLevel.low;
  final validPattern = RegExp(r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{3}$');
  return validPattern.hasMatch(gst) ? ConfidenceLevel.high : ConfidenceLevel.medium;
}

ConfidenceLevel dateConfidence(String date) {
  if (date == "Not Found" || date.isEmpty) return ConfidenceLevel.low;
  final pattern = RegExp(r'^\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}$');
  return pattern.hasMatch(date) ? ConfidenceLevel.high : ConfidenceLevel.medium;
}

ConfidenceLevel invoiceConfidence(String invoiceNo) {
  if (invoiceNo == "Not Found" || invoiceNo.isEmpty) return ConfidenceLevel.low;
  if (invoiceNo.length >= 2 && invoiceNo.length <= 20) return ConfidenceLevel.high;
  return ConfidenceLevel.medium;
}

ConfidenceLevel totalConfidence(String total) {
  if (total == "Not Found" || total.isEmpty) return ConfidenceLevel.low;
  final n = num.tryParse(total.replaceAll(',', ''));
  if (n == null || n <= 0) return ConfidenceLevel.low;
  return ConfidenceLevel.high;
}
