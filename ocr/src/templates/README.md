# Trained template layouts

Drop here the JSON layout files produced by **template training** (e.g. `NEW_GOOD_NITS_LAYOUT.json`).

## How to create a layout

1. Use **3 sample invoice images** (same format, e.g. NEW GOOD NITS).
2. In your app or a small script:
   - `preprocess` each image (e.g. `preprocessImage` + optional OpenCV).
   - Run **full-page OCR** to get `words` with bboxes.
   - Call `trainTemplate(images, { preprocess, runOCR })` from `training/TemplateTrainer.js`.
   - Optionally call `downloadLayoutAsJson(layout)` to download the JSON file.
3. Save the downloaded file in this folder (or merge into `TrainedLayouts.js` if you prefer code).

## Layout format

Each region has:

- `y`, `h`: vertical start and height (0–1 fraction of page height).
- Optional `x`, `w`: horizontal start and width (for customer / billMeta).

Example:

```json
{
  "header": { "y": 0, "h": 0.17 },
  "customer": { "y": 0.18, "h": 0.16, "x": 0, "w": 0.6 },
  "billMeta": { "y": 0.18, "h": 0.16, "x": 0.6, "w": 0.4 },
  "table": { "y": 0.36, "h": 0.4 },
  "totals": { "y": 0.78, "h": 0.14 }
}
```

The pipeline uses this via `getTrainedLayout("NEW_GOOD_NITS")` when `useTrainedLayout: true`.
