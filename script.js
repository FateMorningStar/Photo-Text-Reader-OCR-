// Photo Text Reader

const imageInput = document.getElementById("imageInput");
const imagePreview = document.getElementById("imagePreview");
const emptyPreview = document.getElementById("emptyPreview");
const dropzone = document.getElementById("dropzone");

const extractButton = document.getElementById("extractButton");
const textOutput = document.getElementById("textOutput");
const layoutMode = document.getElementById("layoutMode");

const copyButton = document.getElementById("copyButton");
const downloadButton = document.getElementById("downloadButton");
const downloadWordButton = document.getElementById("downloadWordButton");
const downloadPdfButton = document.getElementById("downloadPdfButton");
const clearButton = document.getElementById("clearButton");

const statusMessage = document.getElementById("statusMessage");
const statusIndicator = document.getElementById("statusIndicator");
const characterCount = document.getElementById("characterCount");

const rotateLeftButton = document.getElementById("rotateLeftButton");
const rotateRightButton = document.getElementById("rotateRightButton");

// APPLICATION STATE

let selectedImage = null;
let previewURL = null;
let rotation = 0;
let isProcessing = false;


// STATUS MESSAGE

function setStatus(message, type = "normal") {
    statusMessage.textContent = message;

    statusIndicator.className = "";

    if (type !== "normal") {
        statusIndicator.classList.add(type);
    }
}


// CHARACTER COUNTER

function updateCount() {
    const count = textOutput.value.length;

    characterCount.textContent =
        `${count.toLocaleString()} ${count === 1 ? "character" : "characters"}`;
}

textOutput.addEventListener("input", updateCount);


// IMAGE UPLOAD

function setImage(file) {

    if (!file) return;

    if (!["image/png", "image/jpeg"].includes(file.type)) {
        setStatus("Please upload a JPG or PNG image.", "error");
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
    imagePreview.hidden = false;

    emptyPreview.hidden = true;

    textOutput.value = "";
    updateCount();

    extractButton.disabled = false;

    rotateLeftButton.disabled = false;
    rotateRightButton.disabled = false;

    setStatus(
        "Image ready. Choose a layout mode, then extract the text.",
        "success"
    );
}

imageInput.addEventListener("change", function () {
    setImage(imageInput.files[0]);
});


// IMAGE ROTATION

function rotateImage(degrees) {

    if (!selectedImage) {
        setStatus("Please upload an image first.", "error");
        return;
    }

    rotation = (rotation + degrees + 360) % 360;

    imagePreview.style.transform =
        `rotate(${rotation}deg)`;
}

rotateLeftButton.addEventListener("click", function () {
    rotateImage(-90);
});

rotateRightButton.addEventListener("click", function () {
    rotateImage(90);
});


// DRAG AND DROP UPLOAD

dropzone.addEventListener("dragover", function (event) {
    event.preventDefault();
    dropzone.classList.add("drag-over");
});

dropzone.addEventListener("dragleave", function () {
    dropzone.classList.remove("drag-over");
});

dropzone.addEventListener("drop", function (event) {

    event.preventDefault();

    dropzone.classList.remove("drag-over");

    const file = event.dataTransfer.files[0];

    if (file) {
        setImage(file);

        try {
            const transfer = new DataTransfer();

            transfer.items.add(file);

            imageInput.files = transfer.files;

        } catch (error) {
            console.warn("Unable to synchronize file input.", error);
        }
    }
});


// IMAGE PREPROCESSING

function preprocessImage(file) {

    return new Promise((resolve, reject) => {

        const image = new Image();
        const url = URL.createObjectURL(file);

        image.onload = function () {

            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");

            const sideways =
                rotation === 90 || rotation === 270;

            canvas.width = sideways
                ? image.height
                : image.width;

            canvas.height = sideways
                ? image.width
                : image.height;

            context.translate(
                canvas.width / 2,
                canvas.height / 2
            );

            context.rotate(
                (rotation * Math.PI) / 180
            );

            context.drawImage(
                image,
                -image.width / 2,
                -image.height / 2
            );

            URL.revokeObjectURL(url);

            resolve(canvas);
        };

        image.onerror = function () {

            URL.revokeObjectURL(url);

            reject(new Error("Unable to load image."));
        };

        image.src = url;
    });
}


// OCR TEXT EXTRACTION

extractButton.addEventListener("click", async function () {

    if (!selectedImage || isProcessing) {

        if (!selectedImage) {
            setStatus("Please upload an image first.", "error");
        }

        return;
    }

    isProcessing = true;

    extractButton.disabled = true;
    extractButton.textContent = "Extracting…";

    setStatus("Preparing image…", "busy");

    try {

        const processedImage =
            await preprocessImage(selectedImage);

        const result = await Tesseract.recognize(
            processedImage,
            "eng",
            {
                logger: function (info) {

                    if (info.status === "recognizing text") {

                        const progress =
                            Math.round(info.progress * 100);

                        setStatus(
                            `Recognizing text: ${progress}%`,
                            "busy"
                        );
                    }
                },

                // Use the selected OCR layout mode.
                tessedit_pageseg_mode: Number(layoutMode.value),

                preserve_interword_spaces: "1"
            }
        );

        textOutput.value =
            (result.data.text || "").trim();

        updateCount();

        if (textOutput.value) {

            setStatus(
                "Text extraction completed. Review the result for possible OCR errors.",
                "success"
            );

        } else {

            setStatus(
                "No text detected. Try a clearer image or another layout mode.",
                "error"
            );
        }

    } catch (error) {

        console.error(error);

        setStatus(
            "Text extraction failed. Please try again.",
            "error"
        );

    } finally {

        isProcessing = false;

        extractButton.disabled = !selectedImage;

        extractButton.innerHTML =
            "✦ &nbsp;Extract text";
    }
});


// COPY TEXT

copyButton.addEventListener("click", async function () {

    const text = textOutput.value;

    if (!text.trim()) {
        setStatus("There is no text to copy.", "error");
        return;
    }

    try {

        await navigator.clipboard.writeText(text);

        setStatus(
            "Text copied to clipboard.",
            "success"
        );

    } catch (error) {

        textOutput.focus();
        textOutput.select();

        const copied = document.execCommand("copy");

        setStatus(
            copied
                ? "Text copied to clipboard."
                : "Unable to copy text.",
            copied ? "success" : "error"
        );
    }
});


// GET TEXT FOR DOWNLOAD

function getText() {

    const text = textOutput.value.trim();

    if (!text) {

        setStatus(
            "There is no text to download.",
            "error"
        );

        return null;
    }

    return text;
}


// DOWNLOAD HELPER

function downloadBlob(blob, filename) {

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);

    link.click();
    link.remove();

    setTimeout(function () {
        URL.revokeObjectURL(url);
    }, 1000);
}


// DOWNLOAD TXT

downloadButton.addEventListener("click", function () {

    const text = getText();

    if (text === null) return;

    const blob = new Blob(
        [text],
        { type: "text/plain;charset=utf-8" }
    );

    downloadBlob(
        blob,
        "extracted-text.txt"
    );

    setStatus(
        "TXT file downloaded.",
        "success"
    );
});


// DOWNLOAD WORD

downloadWordButton.addEventListener("click", async function () {

    const text = getText();

    if (text === null) return;

    try {

        if (!window.docx) {
            throw new Error("Word library unavailable.");
        }

        const {
            Document,
            Paragraph,
            TextRun,
            Packer
        } = window.docx;

        const paragraphs = text.split("\n").map(function (line) {

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

        downloadBlob(
            blob,
            "extracted-text.docx"
        );

        setStatus(
            "Word document downloaded.",
            "success"
        );

    } catch (error) {

        console.error(error);

        setStatus(
            "Unable to create the Word document. Check your connection.",
            "error"
        );
    }
});


// DOWNLOAD PDF

downloadPdfButton.addEventListener("click", function () {

    const text = getText();

    if (text === null) return;

    try {

        if (!window.jspdf) {
            throw new Error("PDF library unavailable.");
        }

        const { jsPDF } = window.jspdf;

        const pdf = new jsPDF();

        const lines =
            pdf.splitTextToSize(text, 180);

        let y = 15;

        lines.forEach(function (line) {

            if (y > 280) {
                pdf.addPage();
                y = 15;
            }

            pdf.text(line, 15, y);

            y += 7;
        });

        pdf.save("extracted-text.pdf");

        setStatus(
            "PDF document downloaded.",
            "success"
        );

    } catch (error) {

        console.error(error);

        setStatus(
            "Unable to create the PDF document. Check your connection.",
            "error"
        );
    }
});


// CLEAR EVERYTHING

clearButton.addEventListener("click", function () {

    imageInput.value = "";

    imagePreview.removeAttribute("src");
    imagePreview.hidden = true;

    emptyPreview.hidden = false;

    imagePreview.style.transform = "rotate(0deg)";

    textOutput.value = "";
    updateCount();

    selectedImage = null;
    rotation = 0;

    if (previewURL) {

        URL.revokeObjectURL(previewURL);

        previewURL = null;
    }

    extractButton.disabled = true;

    rotateLeftButton.disabled = true;
    rotateRightButton.disabled = true;

    setStatus(
        "Cleared. Upload another image to begin."
    );
});


// INITIALIZE CHARACTER COUNTER

updateCount();
