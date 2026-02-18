import 'package:flutter/material.dart';
import 'screens/ocr_home_screen.dart';

void main() {
  runApp(const TextileOCRApp());
}

class TextileOCRApp extends StatelessWidget {
  const TextileOCRApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Textile OCR Module',
      theme: ThemeData(
        primarySwatch: Colors.indigo,
        useMaterial3: true,
      ),
      home: const OCRHomeScreen(),
    );
  }
}
