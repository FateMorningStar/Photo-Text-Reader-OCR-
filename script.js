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

// IMAGE SELECTION
imageInput.addEventListener("change", function () {
    const file = imageInput.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
        statusMessage.textContent =
            "Please select a valid image.";

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

    extractButton.disabled = false;
    textOutput.value = "";

    statusMessage.textContent =
        "Image uploaded. Ready to extract text.";
});

// MANUAL IMAGE ROTATION
function rotateImage(direction) {
    if (!selectedImage) {
        statusMessage.textContent =
            "Please upload an image first.";
        return;
    }

    rotation = (rotation + direction + 360) % 360;

    imagePreview.style.transform =
        `rotate(${rotation}deg)`;

    statusMessage.textContent =
        `Image rotated ${rotation}°.`;
}

// PREPROCESS IMAGE
function preprocessImage(imageFile, angle = 0) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const imageURL = URL.createObjectURL(imageFile);

        image.onload = function () {
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");

            const scale = Math.min(
                2,
                3000 / Math.max(image.width, image.height)
            );

            const width = Math.round(image.width * scale);
            const height = Math.round(image.height * scale);

            const normalizedAngle =
                ((angle % 360) + 360) % 360;

            if (
                normalizedAngle === 90 ||
                normalizedAngle === 270
            ) {
                canvas.width = height;
                canvas.height = width;
            } else {
                canvas.width = width;
                canvas.height = height;
            }

            context.translate(
                canvas.width / 2,
                canvas.height / 2
            );

            context.rotate(
                normalizedAngle * Math.PI / 180
            );

            context.drawImage(
                image,
                -width / 2,
                -height / 2,
                width,
                height
            );

            URL.revokeObjectURL(imageURL);
            resolve(canvas);
        };

        image.onerror = function () {
            URL.revokeObjectURL(imageURL);

            reject(
                new Error("Could not load image.")
            );
        };

        image.src = imageURL;
    });
}

// EXTRACT TEXT
extractButton.addEventListener("click", async function () {
    if (!selectedImage) {
        statusMessage.textContent =
            "Please upload an image first.";
        return;
    }

    extractButton.disabled = true;

    try {
        statusMessage.textContent =
            "Preparing image...";

        const processedImage = await preprocessImage(
            selectedImage,
            rotation
        );

        statusMessage.textContent =
            "Starting text recognition...";

        const result = await Tesseract.recognize(
            processedImage,
            "eng",
            {
                logger: function (message) {
                    if (message.status === "recognizing text") {
                        const progress = Math.round(
                            message.progress * 100
                        );

                        statusMessage.textContent =
                            `Extracting text... ${progress}%`;
                    }
                },

                // Use the selected layout mode
                tessedit_pageseg_mode:
                    layoutMode ? layoutMode.value : "1",

                preserve_interword_spaces: "1"
            }
        );

        const cleanedText = result.data.text
            .replace(/[ \t]+/g, " ")
            .replace(/\n{3,}/g, "\n\n")
            .trim();

        textOutput.value = cleanedText;

        if (!cleanedText) {
            statusMessage.textContent =
                "No text detected. Try rotating or cropping the image.";
        } else {
            statusMessage.textContent =
                "Extraction complete. Review the text for errors.";
        }

    } catch (error) {
        console.error("OCR error:", error);

        statusMessage.textContent =
            "OCR failed. Try another image or rotate it manually.";

    } finally {
        extractButton.disabled = false;
    }
});

// COPY TEXT
copyButton.addEventListener("click", async function () {
    const text = textOutput.value;

    if (!text.trim()) {
        statusMessage.textContent =
            "There is no text to copy.";
        return;
    }

    try {
        await navigator.clipboard.writeText(text);

        statusMessage.textContent =
            "Text copied to clipboard.";

    } catch (error) {
        textOutput.focus();
        textOutput.select();

        statusMessage.textContent =
            "Text selected. Copy it manually.";
    }
});

// DOWNLOAD TEXT
downloadButton.addEventListener("click", function () {
    const text = textOutput.value;

    if (!text.trim()) {
        statusMessage.textContent =
            "There is no text to download.";
        return;
    }

    const file = new Blob(
        [text],
        { type: "text/plain;charset=utf-8" }
    );

    const downloadURL = URL.createObjectURL(file);
    const link = document.createElement("a");

    link.href = downloadURL;
    link.download = "extracted-text.txt";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(downloadURL);

    statusMessage.textContent =
        "Text file downloaded.";
});

// CLEAR APP
clearButton.addEventListener("click", function () {
    imageInput.value = "";
    textOutput.value = "";

    selectedImage = null;
    rotation = 0;

    if (previewURL) {
        URL.revokeObjectURL(previewURL);
        previewURL = null;
    }

    imagePreview.src = "";
    imagePreview.hidden = true;
    imagePreview.style.transform = "rotate(0deg)";

    extractButton.disabled = true;

    statusMessage.textContent =
        "Upload an image to get started.";
});
