import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';

void main() {
  runApp(MaterialApp(
    debugShowCheckedModeBanner: false,
    home: OCRScreen(),
  ));
}

class OCRScreen extends StatefulWidget {
  @override
  _OCRScreenState createState() => _OCRScreenState();
}

class _OCRScreenState extends State<OCRScreen> {
  File? imageFile;
  String extractedText = "";
  String invoiceNo = "";
  String date = "";
  String total = "";

  Future<void> pickImage(ImageSource source) async {
    final picked = await ImagePicker().pickImage(source: source);

    if (picked != null) {
      imageFile = File(picked.path);
      setState(() {});
      processImage(picked.path);
    }
  }

  Future<void> processImage(String path) async {
    final inputImage = InputImage.fromFilePath(path);
    final textRecognizer = TextRecognizer(script: TextRecognitionScript.latin);
    final RecognizedText recognizedText =
        await textRecognizer.processImage(inputImage);

    extractedText = recognizedText.text;

    extractFields(extractedText);

    setState(() {});
    textRecognizer.close();
  }

  void extractFields(String text) {
    RegExp invoiceExp = RegExp(r'Invoice\s*No[:\-]?\s*(\S+)');
    RegExp dateExp = RegExp(r'Date[:\-]?\s*([\d/.-]+)');
    RegExp totalExp = RegExp(r'Total\s*Amount[:\-]?\s*([\d,.]+)');

    invoiceNo = invoiceExp.firstMatch(text)?.group(1) ?? "Not Found";
    date = dateExp.firstMatch(text)?.group(1) ?? "Not Found";
    total = totalExp.firstMatch(text)?.group(1) ?? "Not Found";
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text("Bill OCR Scanner")),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(16),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                ElevatedButton(
                  onPressed: () => pickImage(ImageSource.camera),
                  child: Text("Camera"),
                ),
                ElevatedButton(
                  onPressed: () => pickImage(ImageSource.gallery),
                  child: Text("Gallery"),
                ),
              ],
            ),
            SizedBox(height: 20),
            if (imageFile != null)
              Image.file(imageFile!, height: 200),
            SizedBox(height: 20),
            Text("Invoice No: $invoiceNo"),
            Text("Date: $date"),
            Text("Total Amount: $total"),
            SizedBox(height: 20),
            Text("Full Extracted Text:\n$extractedText"),
          ],
        ),
      ),
    );
  }
}