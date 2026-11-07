console.log("PHOTO TEXT READER SCRIPT LOADED");
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
const ocrLanguage = document.getElementById("ocrLanguage");

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


// SPEECH STATE
let speechSession = 0;
let speechQueue = [];
let currentSpeechIndex = 0;
let currentUtterance = null;
let speechIsPaused = false;

let currentChunkOffset = 0;
let utteranceStartOffset = 0;
let hasBoundaryPosition = false;


// DEVICE DETECTION
function isMobileBrowser() {
    return /Android|iPhone|iPad|iPod/i.test(
        navigator.userAgent
    ) || navigator.maxTouchPoints > 0;
}

const isMobile = isMobileBrowser();

setStatus(
    "Speech mode detected: " + (isMobile ? "Mobile" : "Desktop"),
    "success"
);


// SPEECH LANGUAGE MAPPING
const speechLanguages = {
    eng: "en-US",
    chi_sim: "zh-CN",
    chi_tra: "zh-TW",
    jpn: "ja-JP",
    kor: "ko-KR"
};


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
    ocrLanguage.disabled = processing;

    extractButton.disabled = processing || !selectedImage;
    extractSelectedButton.disabled = processing || !cropper;

    rotateLeftButton.disabled = processing || !cropper;
    rotateRightButton.disabled = processing || !cropper;

    clearButton.disabled = processing;

    extractButton.textContent = processing
        ? "Extracting…"
        : "✦  Extract full page";

    extractSelectedButton.textContent = processing
        ? "Extracting…"
        : "▣  Extract selected area";
}


// UPDATE SPEECH BUTTONS
function updateSpeechButtons() {
    if (!("speechSynthesis" in window)) {
        speakButton.disabled = true;
        pauseButton.disabled = true;
        resumeButton.disabled = true;
        stopButton.disabled = true;
        return;
    }

    const active = speechQueue.length > 0;

    speakButton.disabled = active;
    pauseButton.disabled = !active || speechIsPaused;
    resumeButton.disabled = !active || !speechIsPaused;
    stopButton.disabled = !active;
}


// STOP SPEECH
function stopSpeech() {
    speechSession++;

    speechQueue = [];
    currentSpeechIndex = 0;
    currentUtterance = null;
    speechIsPaused = false;

    currentChunkOffset = 0;
    utteranceStartOffset = 0;
    hasBoundaryPosition = false;

    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }

    updateSpeechButtons();
}


// IMAGE UPLOAD
function setImage(file) {
    if (!file || isProcessing) return;

    if (!["image/png", "image/jpeg"].includes(file.type)) {
        setStatus("Please upload a JPG or PNG image.", "error");
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
                cropBoxMovable: true,
                cropBoxResizable: true,

                responsive: true,
                restore: false,
                checkOrientation: true,

                background: false,
                movable: false,
                zoomable: false,
                scalable: false,
                rotatable: true,

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
            setStatus("Unable to initialize image selection.", "error");
            setProcessingState(false);
        }
    };

    imagePreview.onerror = function () {
        setStatus("Unable to display this image.", "error");
        setProcessingState(false);
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

imageInput.addEventListener("change", function () {
    setImage(imageInput.files[0]);
});


// IMAGE ROTATION
function rotateImage(degrees) {
    if (!cropper || isProcessing) return;

    cropper.rotate(degrees);
    rotation = (rotation + degrees + 360) % 360;

    setStatus(
        degrees < 0 ? "Image rotated left." : "Image rotated right.",
        "success"
    );
}

rotateLeftButton.addEventListener("click", function () {
    rotateImage(-90);
});

rotateRightButton.addEventListener("click", function () {
    rotateImage(90);
});


// DRAG AND DROP
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

    if (isProcessing) return;

    const file = event.dataTransfer.files[0];

    if (file) {
        setImage(file);

        if (["image/png", "image/jpeg"].includes(file.type)) {
            try {
                const transfer = new DataTransfer();
                transfer.items.add(file);
                imageInput.files = transfer.files;
            } catch (error) {
                console.warn("Unable to synchronize file input.", error);
            }
        }
    }
});


// PREPARE ORIGINAL IMAGE FOR FULL-PAGE OCR
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

            const sideways = rotation === 90 || rotation === 270;

            canvas.width = sideways ? image.height : image.width;
            canvas.height = sideways ? image.width : image.height;

            context.translate(canvas.width / 2, canvas.height / 2);
            context.rotate((rotation * Math.PI) / 180);

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

    const selectedLanguage = ocrLanguage.value;

    setProcessingState(true);
    setStatus("Preparing OCR language data…", "busy");

    try {
        if (
            typeof Tesseract === "undefined" ||
            typeof Tesseract.createWorker !== "function"
        ) {
            throw new Error("Tesseract.js is unavailable.");
        }

        worker = await Tesseract.createWorker(
            selectedLanguage,
            1,
            {
                logger: function (info) {
                    if (
                        info.status === "loading language traineddata" ||
                        info.status === "recognizing text"
                    ) {
                        const progress = Math.round(info.progress * 100);

                        setStatus(
                            `${info.status === "recognizing text"
                                ? "Recognizing text"
                                : "Loading language data"}: ${progress}%`,
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
        const extractedText = (result.data.text || "").trim();

        textOutput.value = extractedText;
        updateCount();

        stopSpeech();

        if (extractedText) {
            setStatus(
                "Extraction completed. Review the text for possible OCR errors.",
                "success"
            );
        } else {
            setStatus(
                "No text detected. Try a clearer image or another language.",
                "error"
            );
        }

    } catch (error) {
        console.error("OCR Error:", error);

        setStatus(
            "Extraction failed. Check your connection and selected language.",
            "error"
        );

    } finally {
        if (worker) {
            try {
                await worker.terminate();
            } catch (error) {
                console.warn("Unable to terminate OCR worker.", error);
            }
        }

        setProcessingState(false);
    }
}


// FULL-PAGE OCR
extractButton.addEventListener("click", async function () {
    if (!selectedImage || isProcessing) return;

    try {
        const processedImage = await preprocessImage(selectedImage);
        await performOCR(processedImage);

    } catch (error) {
        console.error(error);
        setStatus("Unable to prepare the image for OCR.", "error");
        setProcessingState(false);
    }
});


// SELECTED-AREA OCR
extractSelectedButton.addEventListener("click", async function () {
    if (!cropper || isProcessing) return;

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
            setStatus("Please select a valid image area.", "error");
            return;
        }

        await performOCR(selectedCanvas);

    } catch (error) {
        console.error(error);
        setStatus("Unable to extract the selected area.", "error");
        setProcessingState(false);
    }
});


// TEXT-TO-SPEECH SYSTEM

// SPLIT TEXT INTO READABLE CHUNKS
function splitSpeechText(text) {
    const chunks = text.match(/[^.!?。！？\n]+[.!?。！？]?/g);

    return chunks
        ? chunks.map(part => part.trim()).filter(Boolean)
        : [text];
}


// READ NEXT CHUNK
function speakNextChunk(session) {
    if (
        session !== speechSession ||
        speechIsPaused
    ) {
        return;
    }

    if (currentSpeechIndex >= speechQueue.length) {
        speechQueue = [];
        currentUtterance = null;
        speechIsPaused = false;

        currentChunkOffset = 0;
        utteranceStartOffset = 0;
        hasBoundaryPosition = false;

        setStatus("Finished reading the text.", "success");
        updateSpeechButtons();
        return;
    }

    const chunk = speechQueue[currentSpeechIndex];

    utteranceStartOffset = currentChunkOffset;

    const remainingText = chunk.slice(utteranceStartOffset);

    if (!remainingText.trim()) {
        currentSpeechIndex++;
        currentChunkOffset = 0;
        hasBoundaryPosition = false;

        speakNextChunk(session);
        return;
    }

    const utterance = new SpeechSynthesisUtterance(remainingText);

    currentUtterance = utterance;

    utterance.lang =
        speechLanguages[ocrLanguage.value] || "en-US";

    utterance.rate = Number(speechRate.value);
    utterance.pitch = 1;

    utterance.onstart = function () {
        if (session !== speechSession) return;

        setStatus("Reading text aloud…", "success");
        updateSpeechButtons();
    };

    // TRACK WORD POSITION
    utterance.onboundary = function (event) {
        if (
            session !== speechSession ||
            event.name !== "word"
        ) {
            return;
        }

        currentChunkOffset =
            utteranceStartOffset + event.charIndex;

        hasBoundaryPosition = true;
    };

    utterance.onend = function () {
        if (session !== speechSession) return;

        currentUtterance = null;
        currentSpeechIndex++;

        currentChunkOffset = 0;
        utteranceStartOffset = 0;
        hasBoundaryPosition = false;

        speakNextChunk(session);
    };

    utterance.onerror = function (event) {
        if (session !== speechSession) return;

        if (
            event.error === "canceled" ||
            event.error === "interrupted"
        ) {
            return;
        }

        console.error("Speech error:", event);

        setStatus("Unable to read the text aloud.", "error");
        stopSpeech();
    };

    window.speechSynthesis.speak(utterance);
}


// READ ALOUD
speakButton.addEventListener("click", function () {
    const text = textOutput.value.trim();

    if (!text) {
        setStatus("There is no text to read aloud.", "error");
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

    speechQueue = splitSpeechText(text);
    currentSpeechIndex = 0;
    currentChunkOffset = 0;
    utteranceStartOffset = 0;
    hasBoundaryPosition = false;
    speechIsPaused = false;

    const session = speechSession;

    updateSpeechButtons();
    speakNextChunk(session);
});


// ========================================
// DESKTOP / PC SPEECH CONTROLS
// ========================================

function pauseDesktopSpeech() {
    window.speechSynthesis.pause();

    setStatus("Speech paused.", "success");
    updateSpeechButtons();
}

function resumeDesktopSpeech() {
    window.speechSynthesis.resume();

    setStatus("Resuming speech…", "success");
    updateSpeechButtons();
}


// ========================================
// MOBILE BROWSER SPEECH CONTROLS
// ========================================

function pauseMobileSpeech() {
    // Invalidate callbacks from the current utterance.
    speechSession++;

    // Cancel playback but retain the approximate position.
    window.speechSynthesis.cancel();

    currentUtterance = null;

    if (hasBoundaryPosition) {
        setStatus("Speech paused. Position saved.", "success");
    } else {
        setStatus(
            "Speech paused. Resume may restart the current sentence."
        );
    }

    updateSpeechButtons();
}

function resumeMobileSpeech() {
    const session = speechSession;

    setStatus("Preparing to resume speech…", "busy");
    updateSpeechButtons();

    setTimeout(function () {
        if (
            session !== speechSession ||
            speechIsPaused
        ) {
            return;
        }

        speakNextChunk(session);

    }, 500);
}


// ========================================
// PAUSE — AUTOMATIC DEVICE SELECTION
// ========================================

pauseButton.addEventListener("click", function () {
    if (!speechQueue.length || speechIsPaused) {
        return;
    }

    speechIsPaused = true;

    if (isMobile) {
        pauseMobileSpeech();
    } else {
        pauseDesktopSpeech();
    }
});


// ========================================
// RESUME — AUTOMATIC DEVICE SELECTION
// ========================================

resumeButton.addEventListener("click", function () {
    if (!speechQueue.length || !speechIsPaused) {
        return;
    }

    speechIsPaused = false;

    if (isMobile) {
        resumeMobileSpeech();
    } else {
        resumeDesktopSpeech();
    }
});


// STOP
stopButton.addEventListener("click", function () {
    stopSpeech();
    setStatus("Speech stopped.");
});


// STOP SPEECH WHEN TEXT CHANGES
textOutput.addEventListener("input", function () {
    if (speechQueue.length > 0) {
        stopSpeech();
    }
});

// CLEAR ALL
clearButton.addEventListener("click", function () {
    if (isProcessing) return;

    // Stop speech playback
    stopSpeech();

    // Destroy image selection
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }

    // Remove uploaded image
    selectedImage = null;
    rotation = 0;

    if (previewURL) {
        URL.revokeObjectURL(previewURL);
        previewURL = null;
    }

    imageInput.value = "";
    imagePreview.removeAttribute("src");
    imagePreview.hidden = true;
    emptyPreview.hidden = false;

    // Clear extracted text
    textOutput.value = "";
    updateCount();

    // Reset controls
    setProcessingState(false);

    extractButton.disabled = true;
    extractSelectedButton.disabled = true;
    rotateLeftButton.disabled = true;
    rotateRightButton.disabled = true;

    setStatus("All content cleared.", "success");
});


// COPY AND EXPORT

// COPY TEXT
copyButton.addEventListener("click", async function () {
    const text = textOutput.value;

    if (!text.trim()) {
        setStatus("There is no text to copy.", "error");
        return;
    }

    try {
        await navigator.clipboard.writeText(text);
        setStatus("Text copied to clipboard.", "success");

    } catch (error) {
        textOutput.focus();
        textOutput.select();

        const copied = document.execCommand("copy");

        setStatus(
            copied ? "Text copied to clipboard." : "Unable to copy text.",
            copied ? "success" : "error"
        );
    }
});


// GET TEXT
function getText() {
    const text = textOutput.value.trim();

    if (!text) {
        setStatus("There is no text to download.", "error");
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


// TXT EXPORT
downloadButton.addEventListener("click", function () {
    const text = getText();
    if (text === null) return;

    const blob = new Blob(
        [text],
        { type: "text/plain;charset=utf-8" }
    );

    downloadBlob(blob, "extracted-text.txt");
    setStatus("TXT file downloaded.", "success");
});


// WORD EXPORT
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
                children: [new TextRun(line)]
            });
        });

        const documentFile = new Document({
            sections: [{
                properties: {},
                children: paragraphs
            }]
        });

        const blob = await Packer.toBlob(documentFile);

        downloadBlob(blob, "extracted-text.docx");
        setStatus("Word document downloaded.", "success");

    } catch (error) {
        console.error(error);
        setStatus("Unable to create the Word document.", "error");
    }
});


// PDF EXPORT
downloadPdfButton.addEventListener("click", function () {
    const text = getText();
    if (text === null) return;

    try {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            throw new Error("PDF library unavailable.");
        }

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        const margin = 15;
        const lineHeight = 7;

        const lines = pdf.splitTextToSize(
            text,
            pageWidth - margin * 2
        );

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

        setStatus("PDF document downloaded.", "success");

    } catch (error) {
        console.error(error);
        setStatus("Unable to create the PDF document.", "error");
    }
});


// INITIALIZATION
updateCount();
updateSpeechButtons();
