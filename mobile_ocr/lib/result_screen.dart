import 'dart:io';
import 'package:flutter/material.dart';
import 'package:mobile_ocr/bill_extractor.dart';
import 'package:mobile_ocr/database_service.dart';

class ResultScreen extends StatefulWidget {
  final BillData billData;
  final String imagePath;

  const ResultScreen({
    Key? key,
    required this.billData,
    required this.imagePath,
  }) : super(key: key);

  @override
  State<ResultScreen> createState() => _ResultScreenState();
}

class _ResultScreenState extends State<ResultScreen> {
  late BillData _billData;
  bool _isEditing = false;
  final List<bool> _fieldVisible = [false, false, false, false];

  @override
  void initState() {
    super.initState();
    _billData = widget.billData;
    _scheduleStagger();
  }

  void _scheduleStagger() {
    for (var i = 0; i < 4; i++) {
      Future.delayed(Duration(milliseconds: 100 + (i * 80)), () {
        if (!mounted) return;
        setState(() => _fieldVisible[i] = true);
      });
    }
  }

  Color _confidenceColor(ConfidenceLevel level) {
    switch (level) {
      case ConfidenceLevel.high:
        return Colors.green;
      case ConfidenceLevel.medium:
        return Colors.orange;
      case ConfidenceLevel.low:
        return Colors.red;
    }
  }

  Widget _confidenceBadge(ConfidenceLevel level) {
    return Container(
      width: 12,
      height: 12,
      decoration: BoxDecoration(
        color: _confidenceColor(level),
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 1),
      ),
    );
  }

  Future<void> _confirmAndSave() async {
    final record = BillRecord(
      invoiceNo: _billData.invoiceNumberDisplay,
      date: _billData.dateDisplay,
      gst: _billData.gstDisplay,
      total: _billData.totalDisplay,
    );
    try {
      await DatabaseService.insertBill(record);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().contains('UNIQUE') ? 'Invoice number already saved.' : 'Save failed.'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Bill saved successfully.'),
        backgroundColor: Colors.green,
      ),
    );
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Extraction Result'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _buildBillPreview(),
            const SizedBox(height: 20),
            _buildExtractedDetails(),
            const SizedBox(height: 24),
            Row(
              children: [
                if (_isEditing)
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => setState(() => _isEditing = false),
                      icon: const Icon(Icons.close),
                      label: const Text('Cancel'),
                    ),
                  ),
                if (_isEditing) const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _isEditing ? () => setState(() => _isEditing = false) : () => setState(() => _isEditing = true),
                    icon: Icon(_isEditing ? Icons.check : Icons.edit),
                    label: Text(_isEditing ? 'Done Edit' : 'Edit'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: _confirmAndSave,
                    icon: const Icon(Icons.save),
                    label: const Text('Confirm & Save'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBillPreview() {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Bill Preview',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.file(File(widget.imagePath), height: 200, fit: BoxFit.contain),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildExtractedDetails() {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Extracted Details',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 12),
            AnimatedOpacity(opacity: _fieldVisible[0] ? 1 : 0, duration: const Duration(milliseconds: 400), child: _detailRow('Invoice No', _billData.invoiceNumberDisplay, _billData.invoiceConfidence ?? invoiceConfidence(_billData.invoiceNumberDisplay))),
            const Divider(height: 1),
            AnimatedOpacity(opacity: _fieldVisible[1] ? 1 : 0, duration: const Duration(milliseconds: 400), child: _detailRow('Date', _billData.dateDisplay, _billData.dateConfidence ?? dateConfidence(_billData.dateDisplay))),
            const Divider(height: 1),
            AnimatedOpacity(opacity: _fieldVisible[2] ? 1 : 0, duration: const Duration(milliseconds: 400), child: _detailRow('GSTIN', _billData.gstDisplay, _billData.gstConfidence ?? gstConfidence(_billData.gstDisplay))),
            const Divider(height: 1),
            AnimatedOpacity(opacity: _fieldVisible[3] ? 1 : 0, duration: const Duration(milliseconds: 400), child: _detailRow('Total', _billData.totalDisplay, _billData.totalConfidence ?? totalConfidence(_billData.totalDisplay))),
          ],
        ),
      ),
    );
  }

  Widget _detailRow(String label, String value, ConfidenceLevel confidence) {
    final isLow = confidence == ConfidenceLevel.low;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w500),
          ),
          Expanded(
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 400),
              margin: const EdgeInsets.only(left: 8),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              constraints: const BoxConstraints(minHeight: 24),
              decoration: BoxDecoration(
                color: isLow ? Colors.red.shade50 : null,
                borderRadius: BorderRadius.circular(8),
              ),
              alignment: Alignment.centerRight,
              child: _isEditing
                  ? TextFormField(
                      key: ValueKey('$label-$value'),
                      initialValue: value,
                      textAlign: TextAlign.end,
                      style: Theme.of(context).textTheme.bodyMedium,
                      decoration: const InputDecoration(
                        isDense: true,
                        border: InputBorder.none,
                        contentPadding: EdgeInsets.zero,
                        filled: false,
                      ),
                      onChanged: (v) {
                        if (label == 'Invoice No') _billData = _billData.copyWith(invoiceNumber: v.isEmpty ? null : v);
                        if (label == 'Date') _billData = _billData.copyWith(date: v.isEmpty ? null : v);
                        if (label == 'GSTIN') _billData = _billData.copyWith(gst: v.isEmpty ? null : v);
                        if (label == 'Total') _billData = _billData.copyWith(total: v.isEmpty ? null : v);
                        setState(() {});
                      },
                    )
                  : Text(
                      value,
                      textAlign: TextAlign.end,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: value == "Not Found" ? Colors.red.shade700 : Colors.green.shade700,
                          ),
                    ),
            ),
          ),
          const SizedBox(width: 8),
          _confidenceBadge(confidence),
        ],
      ),
    );
  }
}
