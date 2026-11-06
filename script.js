// PHOTO TEXT READER
// ELEMENT REFERENCES
const imageInput = document.getElementById("imageInput");
const imagePreview = document.getElementById("imagePreview");
const emptyPreview = document.getElementById("emptyPreview");
const dropzone = document.getElementById("dropzone");

const extractButton = document.getElementById("extractButton");
const extractSelectedButton = document.getElementById("extractSelectedButton");

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

const speakButton = document.getElementById("speakButton");
const pauseButton = document.getElementById("pauseButton");
const resumeButton = document.getElementById("resumeButton");
const stopButton = document.getElementById("stopButton");
const speechRate = document.getElementById("speechRate");


// APPLICATION STATE
let selectedImage = null;
let previewURL = null;

let rotation = 0;
let isProcessing = false;

let cropper = null;
let currentUtterance = null;
let speechSession = 0;

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

// PROCESSING CONTROLS
function setProcessingState(processing) {

    isProcessing = processing;

    imageInput.disabled = processing;
    layoutMode.disabled = processing;

    extractButton.disabled =
        processing || !selectedImage;

    extractSelectedButton.disabled =
        processing || !cropper;

    rotateLeftButton.disabled =
        processing || !cropper;

    rotateRightButton.disabled =
        processing || !cropper;

    clearButton.disabled = processing;

    dropzone.classList.toggle("busy", processing);

    extractButton.textContent = processing
        ? "Extracting…"
        : "✦  Extract full page";

    extractSelectedButton.textContent = processing
        ? "Extracting…"
        : "▣  Extract selected area";
}

// STOP SPEECH
function stopSpeech() {

    speechSession++;

    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }

    currentUtterance = null;

    updateSpeechButtons();
}

// IMAGE UPLOAD
function setImage(file) {

    if (isProcessing || !file) {
        return;
    }

    if (!["image/png", "image/jpeg"].includes(file.type)) {

        setStatus(
            "Please upload a JPG or PNG image.",
            "error"
        );

        imageInput.value = "";

        return;
    }

    stopSpeech();

    if (cropper) {
        cropper.destroy();
        cropper = null;
    }

    selectedImage = file;
    rotation = 0;

    if (previewURL) {
        URL.revokeObjectURL(previewURL);
    }

    previewURL = URL.createObjectURL(file);

    imagePreview.onload = function () {

        imagePreview.onload = null;

        try {

            if (typeof Cropper === "undefined") {
                throw new Error("Cropper.js is unavailable.");
            }

            cropper = new Cropper(imagePreview, {

                viewMode: 1,

                dragMode: "crop",

                autoCrop: true,
                autoCropArea: 0.8,

                responsive: true,
                background: false,

                movable: false,
                zoomable: false,
                scalable: false,

                rotatable: true,

                cropBoxMovable: true,
                cropBoxResizable: true,

                guides: true,
                center: true,
                highlight: true,

                ready: function () {

                    setProcessingState(false);

                    setStatus(
                        "Image ready. Select an area or extract the full page.",
                        "success"
                    );
                }
            });

        } catch (error) {

            console.error(error);

            setStatus(
                "Unable to initialize the image selection tool. Check your connection.",
                "error"
            );
        }
    };

    imagePreview.onerror = function () {

        setStatus(
            "Unable to display this image.",
            "error"
        );
    };

    imagePreview.src = previewURL;
    imagePreview.hidden = false;

    emptyPreview.hidden = true;

    textOutput.value = "";
    updateCount();

    extractButton.disabled = true;
    extractSelectedButton.disabled = true;

    rotateLeftButton.disabled = true;
    rotateRightButton.disabled = true;

    setStatus("Loading image preview…", "busy");
}

// FILE INPUT
imageInput.addEventListener("change", function () {

    setImage(imageInput.files[0]);

});

// IMAGE ROTATION
function rotateImage(degrees) {

    if (isProcessing || !cropper) {
        return;
    }

    cropper.rotate(degrees);

    rotation = (rotation + degrees + 360) % 360;

    setStatus(
        degrees < 0
            ? "Image rotated left."
            : "Image rotated right.",
        "success"
    );
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

    if (!isProcessing) {
        dropzone.classList.add("drag-over");
    }
});

dropzone.addEventListener("dragleave", function () {

    dropzone.classList.remove("drag-over");

});

dropzone.addEventListener("drop", function (event) {

    event.preventDefault();

    dropzone.classList.remove("drag-over");

    if (isProcessing) {
        return;
    }

    const file = event.dataTransfer.files[0];

    if (file) {

        setImage(file);

        if (["image/png", "image/jpeg"].includes(file.type)) {

            try {

                const transfer = new DataTransfer();

                transfer.items.add(file);

                imageInput.files = transfer.files;

            } catch (error) {

                console.warn(
                    "Unable to synchronize file input.",
                    error
                );
            }
        }
    }
});

// IMAGE PREPROCESSING FOR FULL-PAGE OCR
function preprocessImage(file) {

    return new Promise((resolve, reject) => {

        const image = new Image();

        const url = URL.createObjectURL(file);

        image.onload = function () {

            const canvas = document.createElement("canvas");

            const context = canvas.getContext("2d");

            if (!context) {

                URL.revokeObjectURL(url);

                reject(new Error("Canvas is not supported."));

                return;
            }

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

// REUSABLE OCR FUNCTION
async function performOCR(imageSource) {

    let worker = null;

    setProcessingState(true);

    setStatus("Preparing image for OCR…", "busy");

    try {

        if (
            typeof Tesseract === "undefined" ||
            typeof Tesseract.createWorker !== "function"
        ) {

            throw new Error("Tesseract.js is unavailable.");
        }

        worker = await Tesseract.createWorker(
            "eng",
            1,
            {
                logger: function (info) {

                    if (info.status === "loading language traineddata") {

                        const progress =
                            Math.round(info.progress * 100);

                        setStatus(
                            `Loading OCR language data: ${progress}%`,
                            "busy"
                        );
                    }

                    if (info.status === "recognizing text") {

                        const progress =
                            Math.round(info.progress * 100);

                        setStatus(
                            `Recognizing text: ${progress}%`,
                            "busy"
                        );
                    }
                }
            }
        );

        await worker.setParameters({

            tessedit_pageseg_mode: Number(layoutMode.value),

            preserve_interword_spaces: "1"

        });

        const result = await worker.recognize(imageSource);

        const extractedText =
            (result.data.text || "").trim();

        textOutput.value = extractedText;

        updateCount();

        stopSpeech();

        if (extractedText) {

            setStatus(
                "Text extraction completed. Review the result for possible OCR errors.",
                "success"
            );

        } else {

            setStatus(
                "No text detected. Try a clearer image or another selection.",
                "error"
            );
        }

    } catch (error) {

        console.error("OCR Error:", error);

        setStatus(
            "Text extraction failed. Check your internet connection and try again.",
            "error"
        );

    } finally {

        if (worker) {

            try {
                await worker.terminate();
            } catch (error) {

                console.warn(
                    "Unable to terminate OCR worker.",
                    error
                );
            }
        }

        setProcessingState(false);
    }
}

// FULL-PAGE OCR
extractButton.addEventListener("click", async function () {

    if (!selectedImage || isProcessing) {
        return;
    }

    try {

        const processedImage =
            await preprocessImage(selectedImage);

        await performOCR(processedImage);

    } catch (error) {

        console.error("Image preparation error:", error);

        setStatus(
            "Unable to prepare the image for OCR.",
            "error"
        );

        setProcessingState(false);
    }
});

// SELECTED-AREA OCR
extractSelectedButton.addEventListener("click", async function () {

    if (!cropper || isProcessing) {
        return;
    }

    try {

        const selectedCanvas = cropper.getCroppedCanvas({

            maxWidth: 3000,
            maxHeight: 3000,

            imageSmoothingEnabled: true,
            imageSmoothingQuality: "high"

        });

        if (
            !selectedCanvas ||
            selectedCanvas.width < 2 ||
            selectedCanvas.height < 2
        ) {

            setStatus(
                "Please select a valid area of the image.",
                "error"
            );

            return;
        }

        await performOCR(selectedCanvas);

    } catch (error) {

        console.error("Selected OCR error:", error);

        setStatus(
            "Unable to extract the selected area.",
            "error"
        );

        setProcessingState(false);
    }
});

// TEXT TO SPEECH
function updateSpeechButtons() {

    if (!("speechSynthesis" in window)) {

        speakButton.disabled = true;
        pauseButton.disabled = true;
        resumeButton.disabled = true;
        stopButton.disabled = true;

        return;
    }

    const speaking = speechSynthesis.speaking;
    const paused = speechSynthesis.paused;

    speakButton.disabled = speaking || paused;
    pauseButton.disabled = !speaking || paused;
    resumeButton.disabled = !paused;
    stopButton.disabled = !speaking && !paused;
}


// READ ALOUD
speakButton.addEventListener("click", function () {

    const text = textOutput.value.trim();

    if (!text) {

        setStatus(
            "There is no text to read aloud.",
            "error"
        );

        return;
    }

    if (!("speechSynthesis" in window)) {

        setStatus(
            "Text-to-Speech is not supported by this browser.",
            "error"
        );

        return;
    }

    stopSpeech();

    const session = speechSession;

    currentUtterance = new SpeechSynthesisUtterance(text);

    currentUtterance.lang = "en-US";
    currentUtterance.rate = Number(speechRate.value);
    currentUtterance.pitch = 1;

    currentUtterance.onstart = function () {

        if (session !== speechSession) return;

        setStatus("Reading text aloud…", "success");

        updateSpeechButtons();
    };

    currentUtterance.onend = function () {

        if (session !== speechSession) return;

        currentUtterance = null;

        setStatus(
            "Finished reading the text.",
            "success"
        );

        updateSpeechButtons();
    };

    currentUtterance.onerror = function (event) {

        if (session !== speechSession) return;

        console.error("Speech error:", event);

        currentUtterance = null;

        setStatus(
            "Unable to read the text aloud.",
            "error"
        );

        updateSpeechButtons();
    };

    speechSynthesis.speak(currentUtterance);

    updateSpeechButtons();
});


// PAUSE
pauseButton.addEventListener("click", function () {

    if (speechSynthesis.speaking && !speechSynthesis.paused) {

        speechSynthesis.pause();

        setStatus("Speech paused.");

        updateSpeechButtons();
    }
});


// RESUME
resumeButton.addEventListener("click", function () {

    if (speechSynthesis.paused) {

        speechSynthesis.resume();

        setStatus(
            "Speech resumed.",
            "success"
        );

        updateSpeechButtons();
    }
});


// STOP
stopButton.addEventListener("click", function () {

    stopSpeech();

    setStatus("Speech stopped.");

});


// STOP PLAYBACK WHEN TEXT CHANGES

textOutput.addEventListener("input", function () {

    if (
        speechSynthesis.speaking ||
        speechSynthesis.paused
    ) {

        stopSpeech();
    }
});

// COPY TEXT
copyButton.addEventListener("click", async function () {

    const text = textOutput.value;

    if (!text.trim()) {

        setStatus(
            "There is no text to copy.",
            "error"
        );

        return;
    }

    try {

        if (!navigator.clipboard) {
            throw new Error("Clipboard API unavailable.");
        }

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

        const paragraphs = text.split(/\r?\n/).map(function (line) {

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

        console.error("Word Export Error:", error);

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

        if (!window.jspdf || !window.jspdf.jsPDF) {

            throw new Error("PDF library unavailable.");
        }

        const { jsPDF } = window.jspdf;

        const pdf = new jsPDF();

        const pageWidth =
            pdf.internal.pageSize.getWidth();

        const pageHeight =
            pdf.internal.pageSize.getHeight();

        const margin = 15;
        const lineHeight = 7;

        const maxWidth =
            pageWidth - margin * 2;

        const lines =
            pdf.splitTextToSize(text, maxWidth);

        let y = margin;

        lines.forEach(function (line) {

            if (y + lineHeight > pageHeight - margin) {

                pdf.addPage();

                y = margin;
            }

            pdf.text(line, margin, y);

            y += lineHeight;
        });

        pdf.save("extracted-text.pdf");

        setStatus(
            "PDF document downloaded.",
            "success"
        );

    } catch (error) {

        console.error("PDF Export Error:", error);

        setStatus(
            "Unable to create the PDF document. Check your connection.",
            "error"
        );
    }
});

// CLEAR EVERYTHING
clearButton.addEventListener("click", function () {

    if (isProcessing) {
        return;
    }

    stopSpeech();

    imageInput.value = "";

    if (cropper) {

        cropper.destroy();

        cropper = null;
    }

    imagePreview.onload = null;
    imagePreview.onerror = null;

    imagePreview.removeAttribute("src");

    imagePreview.hidden = true;

    emptyPreview.hidden = false;

    textOutput.value = "";

    updateCount();

    selectedImage = null;

    rotation = 0;

    if (previewURL) {

        URL.revokeObjectURL(previewURL);

        previewURL = null;
    }

    extractButton.disabled = true;
    extractSelectedButton.disabled = true;

    rotateLeftButton.disabled = true;
    rotateRightButton.disabled = true;

    setStatus(
        "Cleared. Upload another image to begin."
    );

    updateSpeechButtons();
});

// INITIALIZE APPLICATION
updateCount();

updateSpeechButtons();

setStatus("Upload an image to get started.");
