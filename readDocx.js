const mammoth = require('mammoth');
const fs = require('fs');

async function extract() {
  const file1 = "./public/Perjakin BPBD 2026.docx";
  const file2 = "./public/Perjanjian Kinerja Eselon II 2026.docx";

  try {
    let result1 = await mammoth.extractRawText({path: file1});
    console.log("=== Perjakin BPBD 2026 ===");
    console.log(result1.value);

    let result2 = await mammoth.extractRawText({path: file2});
    console.log("=== Perjanjian Kinerja Eselon II 2026 ===");
    console.log(result2.value);
  } catch(e) {
    console.error(e);
  }
}
extract();
