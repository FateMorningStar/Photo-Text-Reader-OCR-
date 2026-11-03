 // PHOTO TEXT READER
 // Main OCR functionality
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

// Disable extraction until an image is uploaded
extractButton.disabled = true;

// Upload image
imageInput.addEventListener("change", () => {
    const file = imageInput.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
        statusMessage.textContent = "Please select a valid image.";
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
    imagePreview.hidden = false;
    imagePreview.style.transform = "rotate(0deg)";

    textOutput.value = "";
    extractButton.disabled = false;

    statusMessage.textContent = "Image loaded. Ready to extract text.";
});

// Rotate image left or right
function rotateImage(direction) {
    if (!selectedImage) {
        statusMessage.textContent = "Please upload an image first.";
        return;
    }

    rotation = (rotation + direction + 360) % 360;

    imagePreview.style.transform = `rotate(${rotation}deg)`;
}

// Prepare image for OCR
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
                normalizedAngle === 90 ||
                normalizedAngle === 270;

            canvas.width = isSideways ? height : width;
            canvas.height = isSideways ? width : height;

            context.translate(
                canvas.width / 2,
                canvas.height / 2
            );

            context.rotate(
                (normalizedAngle * Math.PI) / 180
            );

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

// Extract text using Tesseract.js
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
        extractButton.disabled = !selectedImage;
    }
});

// Copy extracted text
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

// Download extracted text
downloadButton.addEventListener("click", () => {
    if (!textOutput.value.trim()) {
        statusMessage.textContent = "There is no text to download.";
        return;
    }

    const blob = new Blob(
        [textOutput.value],
        { type: "text/plain;charset=utf-8" }
    );

    const downloadURL = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = downloadURL;
    link.download = "extracted-text.txt";

    link.click();

    URL.revokeObjectURL(downloadURL);

    statusMessage.textContent = "Text file downloaded.";
});

// Clear OCR section
clearButton.addEventListener("click", () => {
    imageInput.value = "";
    selectedImage = null;
    rotation = 0;

    imagePreview.removeAttribute("src");
    imagePreview.hidden = true;
    imagePreview.style.transform = "rotate(0deg)";

    textOutput.value = "";
    extractButton.disabled = true;

    if (previewURL) {
        URL.revokeObjectURL(previewURL);
        previewURL = null;
    }

    statusMessage.textContent = "Cleared.";
});
