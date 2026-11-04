// Photo Text Reader - script.js
// HTML elements
const imageInput = document.getElementById("imageInput");
const imagePreview = document.getElementById("imagePreview");
const extractButton = document.getElementById("extractButton");
const textOutput = document.getElementById("textOutput");
const layoutMode = document.getElementById("layoutMode");
const copyButton = document.getElementById("copyButton");
const downloadButton = document.getElementById("downloadButton");
const downloadWordButton = document.getElementById("downloadWordButton");
const downloadPdfButton = document.getElementById("downloadPdfButton");
const clearButton = document.getElementById("clearButton");
const statusMessage = document.getElementById("statusMessage");

// State
let selectedImage = null;
let previewURL = null;
let rotation = 0;

// Upload and preview image
imageInput.addEventListener("change", function () {
    const file = imageInput.files[0];

    if (!file) return;

    if (!["image/png", "image/jpeg"].includes(file.type)) {
        statusMessage.textContent = "Please upload a JPG or PNG image.";
        imageInput.value = "";
        return;
    }

    selectedImage = file;
    rotation = 0;

    if (previewURL) {
        URL.revokeObjectURL(previewURL);
    }

    previewURL = URL.createObjectURL(file);
    imagePreview.src = previewURL;
    imagePreview.style.transform = "rotate(0deg)";
    imagePreview.style.display = "block";

    textOutput.value = "";
    extractButton.disabled = false;

    statusMessage.textContent = "Image uploaded successfully.";
});

// Rotate image
function rotateImage(degrees) {
    if (!selectedImage) {
        statusMessage.textContent = "Please upload an image first.";
        return;
    }

    rotation = (rotation + degrees) % 360;

    imagePreview.style.transform = `rotate(${rotation}deg)`;
}

// Prepare image for OCR
function preprocessImage(file) {
    return new Promise((resolve, reject) => {
        const image = new Image();

        image.onload = function () {
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");

            const isSideways = rotation === 90 || rotation === 270;

            canvas.width = isSideways ? image.height : image.width;
            canvas.height = isSideways ? image.width : image.height;

            context.translate(canvas.width / 2, canvas.height / 2);
            context.rotate((rotation * Math.PI) / 180);

            context.drawImage(
                image,
                -image.width / 2,
                -image.height / 2
            );

            resolve(canvas);
            URL.revokeObjectURL(image.src);
        };

        image.onerror = function () {
            reject(new Error("Unable to load the image."));
        };

        image.src = URL.createObjectURL(file);
    });
}

// Extract text using Tesseract.js
extractButton.addEventListener("click", async function () {
    if (!selectedImage) {
        statusMessage.textContent = "Please upload an image first.";
        return;
    }

    extractButton.disabled = true;
    statusMessage.textContent = "Preparing image...";

    try {
        const processedImage = await preprocessImage(selectedImage);

        statusMessage.textContent = "Extracting text...";

        const result = await Tesseract.recognize(
            processedImage,
            "eng",
            {
                logger: function (info) {
                    if (info.status === "recognizing text") {
                        const progress = Math.round(info.progress * 100);
                        statusMessage.textContent =
                            `Extracting text: ${progress}%`;
                    }
                }
            }
        );

        textOutput.value = result.data.text.trim();

        if (textOutput.value) {
            statusMessage.textContent = "Text extraction completed.";
        } else {
            statusMessage.textContent =
                "No text was detected. Try another image.";
        }
    } catch (error) {
        console.error(error);
        statusMessage.textContent =
            "Text extraction failed. Please try again.";
    } finally {
        extractButton.disabled = false;
    }
});

// Copy extracted or edited text
copyButton.addEventListener("click", async function () {
    const text = textOutput.value;

    if (!text.trim()) {
        statusMessage.textContent = "There is no text to copy.";
        return;
    }

    try {
        await navigator.clipboard.writeText(text);
        statusMessage.textContent = "Text copied to clipboard.";
    } catch (error) {
        textOutput.select();

        const copied = document.execCommand("copy");

        statusMessage.textContent = copied
            ? "Text copied to clipboard."
            : "Unable to copy text.";
    }
});

// Download as TXT
downloadButton.addEventListener("click", function () {
    const text = getTextForDownload();

    if (text === null) return;

    const blob = new Blob([text], {
        type: "text/plain;charset=utf-8"
    });

    const downloadURL = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = downloadURL;
    link.download = "extracted-text.txt";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => {
        URL.revokeObjectURL(downloadURL);
    }, 1000);

    statusMessage.textContent = "TXT file downloaded.";
});

// Download as Word (.docx)
downloadWordButton.addEventListener("click", async function () {
    const text = getTextForDownload();

    if (text === null) return;

    try {
        const { Document, Paragraph, TextRun, Packer } = window.docx;

        const paragraphs = text.split("\n").map(line => {
            return new Paragraph({
                children: [
                    new TextRun(line)
                ]
            });
        });

        const documentFile = new Document({
            sections: [
                {
                    properties: {},
                    children: paragraphs
                }
            ]
        });

        const blob = await Packer.toBlob(documentFile);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = "extracted-text.docx";

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);

        statusMessage.textContent = "Word document downloaded.";
    } catch (error) {
        console.error(error);
        statusMessage.textContent =
            "Unable to create the Word document.";
    }
});

// Download as PDF
downloadPdfButton.addEventListener("click", function () {
    const text = getTextForDownload();

    if (text === null) return;

    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();

        const lines = pdf.splitTextToSize(text, 180);
        let y = 15;

        lines.forEach(line => {
            if (y > 280) {
                pdf.addPage();
                y = 15;
            }

            pdf.text(line, 15, y);
            y += 7;
        });

        pdf.save("extracted-text.pdf");

        statusMessage.textContent = "PDF document downloaded.";
    } catch (error) {
        console.error(error);
        statusMessage.textContent =
            "Unable to create the PDF document.";
    }
});

// Get text for download
function getTextForDownload() {
    const text = textOutput.value.trim();

    if (!text) {
        statusMessage.textContent = "There is no text to download.";
        return null;
    }

    return text;
}

// Clear everything
clearButton.addEventListener("click", function () {
    imageInput.value = "";
    imagePreview.src = "";
    imagePreview.style.display = "none";
    imagePreview.style.transform = "rotate(0deg)";

    textOutput.value = "";

    selectedImage = null;
    rotation = 0;

    if (previewURL) {
        URL.revokeObjectURL(previewURL);
        previewURL = null;
    }

    extractButton.disabled = true;

    statusMessage.textContent = "Cleared.";
});
