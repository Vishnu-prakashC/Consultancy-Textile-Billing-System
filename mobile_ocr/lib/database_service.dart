import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import 'package:path_provider/path_provider.dart';

/// DB model for a saved bill record.
class BillRecord {
  final int? id;
  final String invoiceNo;
  final String date;
  final String gst;
  final String total;
  final String createdAt;

  BillRecord({
    this.id,
    required this.invoiceNo,
    required this.date,
    required this.gst,
    required this.total,
    String? createdAt,
  }) : createdAt = createdAt ?? DateTime.now().toIso8601String();
}

class DatabaseService {
  static Database? _db;
  static const String _table = 'bills';

  static Future<Database> _getDb() async {
    if (_db != null) return _db!;
    final dir = await getApplicationDocumentsDirectory();
    final path = join(dir.path, 'mobile_ocr.db');
    _db = await openDatabase(
      path,
      version: 1,
      onCreate: (db, _) {
        return db.execute('''
          CREATE TABLE $_table (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoiceNo TEXT NOT NULL UNIQUE,
            date TEXT NOT NULL,
            gst TEXT NOT NULL,
            total TEXT NOT NULL,
            createdAt TEXT NOT NULL
          )
        ''');
      },
    );
    return _db!;
  }

  static Future<int> insertBill(BillRecord record) async {
    final db = await _getDb();
    return db.insert(
      _table,
      {
        'invoiceNo': record.invoiceNo,
        'date': record.date,
        'gst': record.gst,
        'total': record.total,
        'createdAt': record.createdAt,
      },
    );
  }

  static Future<void> close() async {
    if (_db != null) {
      await _db!.close();
      _db = null;
    }
  }
}
