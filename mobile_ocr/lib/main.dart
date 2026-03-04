import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';
import 'package:mobile_ocr/bill_extractor.dart';
import 'package:mobile_ocr/result_screen.dart';

void main() {
  runApp(MaterialApp(
    debugShowCheckedModeBanner: false,
    theme: ThemeData(
      primarySwatch: Colors.indigo,
      useMaterial3: true,
    ),
    home: OCRScreen(),
  ));
}

class OCRScreen extends StatefulWidget {
  @override
  _OCRScreenState createState() => _OCRScreenState();
}

class _OCRScreenState extends State<OCRScreen> {
  File? imageFile;
  bool _isProcessing = false;
  String _loadingStep = '';

  Future<void> pickImage(ImageSource source) async {
    final picked = await ImagePicker().pickImage(source: source);
    if (picked == null) return;
    imageFile = File(picked.path);
    setState(() {});
    await processImage(picked.path);
  }

  Future<void> processImage(String path) async {
    setState(() => _isProcessing = true);
    BillData billData = BillData();
    try {
      if (mounted) setState(() => _loadingStep = 'Scanning…');
      final inputImage = InputImage.fromFilePath(path);
      final textRecognizer = TextRecognizer(script: TextRecognitionScript.latin);
      if (mounted) setState(() => _loadingStep = 'Extracting…');
      final recognizedText = await textRecognizer.processImage(inputImage);
      final extractedText = _buildTextFromBlocks(recognizedText);
      textRecognizer.close();

      if (mounted) setState(() => _loadingStep = 'Validating…');
      billData = BillExtractor.extract(extractedText);

      debugPrint('--- Block-level OCR (first 800 chars) ---');
      debugPrint(extractedText.length > 800 ? extractedText.substring(0, 800) : extractedText);
      debugPrint('--- Extracted ---');
      debugPrint('invoice=${billData.invoiceNumber}, date=${billData.date}, gst=${billData.gst}, total=${billData.total}');

      if (!mounted) return;
      await Future.delayed(const Duration(milliseconds: 100));
      if (!mounted) return;
      Navigator.of(context).push(
        PageRouteBuilder(
          pageBuilder: (_, animation, secondaryAnimation) => ResultScreen(billData: billData, imagePath: path),
          transitionsBuilder: (_, animation, secondaryAnimation, child) => FadeTransition(opacity: animation, child: child),
          transitionDuration: const Duration(milliseconds: 300),
        ),
      );
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  String _buildTextFromBlocks(RecognizedText recognizedText) {
    final buffer = StringBuffer();
    for (final block in recognizedText.blocks) {
      for (final line in block.lines) {
        buffer.writeln(line.text.trim());
      }
    }
    return buffer.toString().trim();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text("New Good Nits"),
            Text(
              "Bill Scanning System",
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.white70,
                    fontSize: 12,
                  ),
            ),
          ],
        ),
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _buildUploadSection(),
            if (_isProcessing)
              Padding(
                padding: const EdgeInsets.only(top: 24),
                child: Column(
                  children: [
                    const SizedBox(height: 8),
                    Text(_loadingStep, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.grey)),
                    const SizedBox(height: 12),
                    const CircularProgressIndicator(),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildUploadSection() {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              "Upload Bill Image",
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
            ),
            SizedBox(height: 4),
            Text(
              "JPG / PNG (Max 10MB)",
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.grey,
                  ),
            ),
            SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: AnimatedScale(
                    scale: _isProcessing ? 0.98 : 1.0,
                    duration: const Duration(milliseconds: 150),
                    child: OutlinedButton.icon(
                      onPressed: _isProcessing ? null : () => pickImage(ImageSource.gallery),
                      icon: Icon(Icons.upload_file, size: 20),
                      label: Text("Upload Image"),
                    ),
                  ),
                ),
                SizedBox(width: 12),
                Expanded(
                  child: AnimatedScale(
                    scale: _isProcessing ? 0.98 : 1.0,
                    duration: const Duration(milliseconds: 150),
                    child: OutlinedButton.icon(
                      onPressed: _isProcessing ? null : () => pickImage(ImageSource.camera),
                      icon: Icon(Icons.camera_alt, size: 20),
                      label: Text("Capture Photo"),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}