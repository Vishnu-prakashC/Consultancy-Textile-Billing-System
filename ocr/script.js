const imageInput = document.getElementById("billImage");
const preview = document.getElementById("previewImage");

imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  preview.src = URL.createObjectURL(file);
  preview.style.display = "block";
});

function extractText() {
  const file = imageInput.files[0];
  if (!file) {
    alert("Please upload a bill image");
    return;
  }

  Tesseract.recognize(
    file,
    'eng'
  ).then(result => {
    const text = result.data.text;
    autoFillData(text);
  });
}

function autoFillData(text) {
  document.getElementById("billNo").value =
    text.match(/Invoice\s*No[:\s]*([\w\d]+)/i)?.[1] || "";

  document.getElementById("date").value =
    text.match(/Date[:\s]*([\d\/\-]+)/i)?.[1] || "";

  document.getElementById("gst").value =
    text.match(/GST[:\s]*([\d\.]+)/i)?.[1] || "";

  document.getElementById("total").value =
    text.match(/Total[:\s]*([\d,\.]+)/i)?.[1] || "";
}

function clearForm() {
  document.querySelectorAll("input").forEach(input => input.value = "");
  preview.style.display = "none";
}
