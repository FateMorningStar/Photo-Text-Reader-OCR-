// Main OCR elements
const imageInput = document.getElementById("imageInput");
const imagePreview = document.getElementById("imagePreview");
const extractButton = document.getElementById("extractButton");
const textOutput = document.getElementById("textOutput");
const copyButton = document.getElementById("copyButton");
const downloadButton = document.getElementById("downloadButton");
const clearButton = document.getElementById("clearButton");
const statusMessage = document.getElementById("statusMessage");
const layoutMode = document.getElementById("layoutMode");

let selectedImage = null;
let previewURL = null;
let rotation = 0;

// Math crop elements
const mathImageInput = document.getElementById("mathImageInput");
const mathImagePreview = document.getElementById("mathImagePreview");
const startCropButton = document.getElementById("startCropButton");
const cropArea = document.getElementById("cropArea");
const cropCanvas = document.getElementById("cropCanvas");
const cropButton = document.getElementById("cropButton");
const cancelCropButton = document.getElementById("cancelCropButton");
const croppedCanvas = document.getElementById("croppedCanvas");
const latexOutput = document.getElementById("latexOutput");
const copyLatexButton = document.getElementById("copyLatexButton");
const clearMathButton = document.getElementById("clearMathButton");
const mathStatus = document.getElementById("mathStatus");

const cropContext = cropCanvas.getContext("2d");
const croppedContext = croppedCanvas.getContext("2d");

let mathImage = null;
let mathImageURL = null;
let cropSelection = null;
let cropStart = null;
let isSelecting = false;

// Main OCR image upload
imageInput.addEventListener("change", () => {
    const file = imageInput.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
        statusMessage.textContent = "Please select a valid image.";
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

    textOutput.value = "";
    statusMessage.textContent = "Image loaded. Ready to extract text.";
});

// Rotate main OCR image
function rotateImage(direction) {
    if (!selectedImage) {
        statusMessage.textContent = "Please upload an image first.";
        return;
    }

    rotation = (rotation + direction + 360) % 360;
    imagePreview.style.transform = `rotate(${rotation}deg)`;
}

// Prepare image for Tesseract
function preprocessImage(file, angle = 0) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const objectURL = URL.createObjectURL(file);

        image.onload = () => {
            const maxDimension = 3000;
            const scale = Math.min(
                2,
                maxDimension / Math.max(image.width, image.height)
            );

            const width = Math.round(image.width * scale);
            const height = Math.round(image.height * scale);

            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");

            const normalizedAngle = ((angle % 360) + 360) % 360;
            const isSideways =
                normalizedAngle === 90 || normalizedAngle === 270;

            canvas.width = isSideways ? height : width;
            canvas.height = isSideways ? width : height;

            context.translate(canvas.width / 2, canvas.height / 2);
            context.rotate((normalizedAngle * Math.PI) / 180);

            context.drawImage(
                image,
                -width / 2,
                -height / 2,
                width,
                height
            );

            URL.revokeObjectURL(objectURL);
            resolve(canvas);
        };

        image.onerror = () => {
            URL.revokeObjectURL(objectURL);
            reject(new Error("Could not load the image."));
        };

        image.src = objectURL;
    });
}

// Extract text with Tesseract
extractButton.addEventListener("click", async () => {
    if (!selectedImage) {
        statusMessage.textContent = "Please upload an image first.";
        return;
    }

    extractButton.disabled = true;
    statusMessage.textContent = "Preparing image...";

    try {
        const processedImage = await preprocessImage(
            selectedImage,
            rotation
        );

        statusMessage.textContent = "Extracting text...";

        const result = await Tesseract.recognize(
            processedImage,
            "eng",
            {
                logger: (message) => {
                    if (message.status === "recognizing text") {
                        const progress = Math.round(
                            message.progress * 100
                        );

                        statusMessage.textContent =
                            `Recognizing text... ${progress}%`;
                    }
                },
                tessedit_pageseg_mode: layoutMode.value,
                preserve_interword_spaces: "1"
            }
        );

        textOutput.value = result.data.text.trim();

        statusMessage.textContent = textOutput.value
            ? "Text extraction completed."
            : "No readable text was detected.";

    } catch (error) {
        console.error(error);
        statusMessage.textContent =
            "Text extraction failed. Please try another image.";
    } finally {
        extractButton.disabled = false;
    }
});

// Copy OCR text
copyButton.addEventListener("click", async () => {
    if (!textOutput.value.trim()) {
        statusMessage.textContent = "There is no text to copy.";
        return;
    }

    try {
        await navigator.clipboard.writeText(textOutput.value);
        statusMessage.textContent = "Text copied.";
    } catch (error) {
        textOutput.select();
        document.execCommand("copy");
        statusMessage.textContent = "Text copied.";
    }
});

// Download OCR text
downloadButton.addEventListener("click", () => {
    if (!textOutput.value.trim()) {
        statusMessage.textContent = "There is no text to download.";
        return;
    }

    const blob = new Blob([textOutput.value], {
        type: "text/plain;charset=utf-8"
    });

    const downloadURL = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = downloadURL;
    link.download = "extracted-text.txt";
    link.click();

    URL.revokeObjectURL(downloadURL);
    statusMessage.textContent = "Text file downloaded.";
});

// Clear main OCR section
clearButton.addEventListener("click", () => {
    imageInput.value = "";
    selectedImage = null;
    rotation = 0;

    imagePreview.removeAttribute("src");
    imagePreview.style.transform = "rotate(0deg)";

    textOutput.value = "";
    statusMessage.textContent = "Cleared.";
});

// Math image upload
mathImageInput.addEventListener("change", () => {
    const file = mathImageInput.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
        mathStatus.textContent = "Please select a valid image.";
        return;
    }

    if (mathImageURL) {
        URL.revokeObjectURL(mathImageURL);
    }

    mathImageURL = URL.createObjectURL(file);
    mathImage = new Image();

    mathImage.onload = () => {
        mathImagePreview.src = mathImageURL;

        cropCanvas.width = mathImage.naturalWidth;
        cropCanvas.height = mathImage.naturalHeight;

        cropContext.clearRect(
            0,
            0,
            cropCanvas.width,
            cropCanvas.height
        );

        cropContext.drawImage(
            mathImage,
            0,
            0,
            cropCanvas.width,
            cropCanvas.height
        );

        cropSelection = null;
        cropArea.hidden = true;
        croppedCanvas.width = 0;
        croppedCanvas.height = 0;

        mathStatus.textContent =
            "Image loaded. Select the formula area to crop.";
    };

    mathImage.onerror = () => {
        mathStatus.textContent = "Could not load the selected image.";
    };

    mathImage.src = mathImageURL;
});

// Show crop workspace
startCropButton.addEventListener("click", () => {
    if (!mathImage) {
        mathStatus.textContent = "Please upload a formula image first.";
        return;
    }

    cropArea.hidden = false;
    cropSelection = null;

    drawCropCanvas();
    mathStatus.textContent =
        "Drag across the image to select the formula.";
});

// Draw image and crop selection
function drawCropCanvas() {
    if (!mathImage) return;

    cropContext.clearRect(
        0,
        0,
        cropCanvas.width,
        cropCanvas.height
    );

    cropContext.drawImage(
        mathImage,
        0,
        0,
        cropCanvas.width,
        cropCanvas.height
    );

    if (!cropSelection) return;

    const { x, y, width, height } = cropSelection;

    cropContext.save();

    cropContext.strokeStyle = "#2463a6";
    cropContext.lineWidth = Math.max(
        2,
        cropCanvas.width / 500
    );

    cropContext.setLineDash([
        Math.max(5, cropCanvas.width / 100),
        Math.max(3, cropCanvas.width / 200)
    ]);

    cropContext.strokeRect(x, y, width, height);

    cropContext.fillStyle = "rgba(36, 99, 166, 0.15)";
    cropContext.fillRect(x, y, width, height);

    cropContext.restore();
}

// Convert pointer position to
// original canvas coordinates
function getCanvasPosition(event) {
    const rect = cropCanvas.getBoundingClientRect();

    const scaleX = cropCanvas.width / rect.width;
    const scaleY = cropCanvas.height / rect.height;

    return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY
    };
}

// Crop selection pointer events
// Works with mouse and touch
cropCanvas.addEventListener("pointerdown", (event) => {
    if (!mathImage || cropArea.hidden) return;

    event.preventDefault();
    cropCanvas.setPointerCapture(event.pointerId);

    cropStart = getCanvasPosition(event);
    cropSelection = {
        x: cropStart.x,
        y: cropStart.y,
        width: 0,
        height: 0
    };

    isSelecting = true;
    drawCropCanvas();
});


cropCanvas.addEventListener("pointermove", (event) => {
    if (!isSelecting || !cropStart) return;

    event.preventDefault();

    const current = getCanvasPosition(event);

    const x = Math.min(cropStart.x, current.x);
    const y = Math.min(cropStart.y, current.y);
    const width = Math.abs(current.x - cropStart.x);
    const height = Math.abs(current.y - cropStart.y);

    cropSelection = {
        x,
        y,
        width,
        height
    };

    drawCropCanvas();
});


function finishCropSelection() {
    if (!isSelecting) return;

    isSelecting = false;
    cropStart = null;

    if (
        cropSelection &&
        cropSelection.width > 5 &&
        cropSelection.height > 5
    ) {
        mathStatus.textContent =
            "Area selected. Press Crop Formula to continue.";
    } else {
        cropSelection = null;
        mathStatus.textContent =
            "Selection too small. Please select a larger area.";
    }

    drawCropCanvas();
}


cropCanvas.addEventListener(
    "pointerup",
    finishCropSelection
);

cropCanvas.addEventListener(
    "pointercancel",
    finishCropSelection
);

// Crop selected formula
cropButton.addEventListener("click", () => {
    if (
        !cropSelection ||
        cropSelection.width <= 5 ||
        cropSelection.height <= 5
    ) {
        mathStatus.textContent =
            "Please select the formula area first.";
        return;
    }

    const { x, y, width, height } = cropSelection;

    croppedCanvas.width = Math.round(width);
    croppedCanvas.height = Math.round(height);

    croppedContext.clearRect(
        0,
        0,
        croppedCanvas.width,
        croppedCanvas.height
    );

    croppedContext.drawImage(
        mathImage,
        x,
        y,
        width,
        height,
        0,
        0,
        croppedCanvas.width,
        croppedCanvas.height
    );

    mathStatus.textContent =
        "Formula image cropped. Automatic math recognition is not connected yet.";
});

// Cancel crop workspace
cancelCropButton.addEventListener("click", () => {
    cropArea.hidden = true;
    cropSelection = null;
    isSelecting = false;
    cropStart = null;

    drawCropCanvas();

    mathStatus.textContent = "Crop selection cancelled.";
});

// Copy LaTeX text
copyLatexButton.addEventListener("click", async () => {
    if (!latexOutput.value.trim()) {
        mathStatus.textContent =
            "Enter LaTeX text before copying.";
        return;
    }

    try {
        await navigator.clipboard.writeText(latexOutput.value);
        mathStatus.textContent = "LaTeX copied.";
    } catch (error) {
        latexOutput.select();
        document.execCommand("copy");
        mathStatus.textContent = "LaTeX copied.";
    }
});

// Clear math section
clearMathButton.addEventListener("click", () => {
    mathImageInput.value = "";
    mathImagePreview.removeAttribute("src");

    if (mathImageURL) {
        URL.revokeObjectURL(mathImageURL);
        mathImageURL = null;
    }

    mathImage = null;
    cropSelection = null;
    cropStart = null;
    isSelecting = false;

    cropArea.hidden = true;

    cropCanvas.width = 0;
    cropCanvas.height = 0;

    croppedCanvas.width = 0;
    croppedCanvas.height = 0;

    latexOutput.value = "";
    mathStatus.textContent = "Math section cleared.";
});
