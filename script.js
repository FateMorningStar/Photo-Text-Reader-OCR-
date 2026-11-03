// Get elements from the HTML
const imageInput = document.getElementById("imageInput");
const imagePreview = document.getElementById("imagePreview");
const extractButton = document.getElementById("extractButton");
const textOutput = document.getElementById("textOutput");
const copyButton = document.getElementById("copyButton");
const downloadButton = document.getElementById("downloadButton");
const clearButton = document.getElementById("clearButton");
const statusMessage = document.getElementById("statusMessage");

// Store the selected image
let selectedImage = null;

// Handle image selection
imageInput.addEventListener("change", function () {
    const file = imageInput.files[0];

    if (!file) {
        return;
    }

    if (!file.type.startsWith("image/")) {
        statusMessage.textContent = "Please select a valid image.";
        return;
    }

    selectedImage = file;

    // Show the image preview
    const imageURL = URL.createObjectURL(file);

    imagePreview.src = imageURL;
    imagePreview.hidden = false;

    // Enable the extraction button
    extractButton.disabled = false;

    // Clear previous results
    textOutput.value = "";

    statusMessage.textContent = "Image uploaded. Ready to extract text.";
});

// the Extract text using OCR
extractButton.addEventListener("click", async function () {
    if (!selectedImage) {
        statusMessage.textContent = "Please upload an image first.";
        return;
    }

    extractButton.disabled = true;
    statusMessage.textContent = "Reading image... Please wait.";

    try {
        const result = await Tesseract.recognize(
            selectedImage,
            "eng",
            {
                logger: function (message) {
                    if (message.status === "recognizing text") {
                        const progress = Math.round(message.progress * 100);
                        statusMessage.textContent =
                            `Extracting text... ${progress}%`;
                    }
                }
            }
        );

        textOutput.value = result.data.text;
        statusMessage.textContent = "Text extraction completed.";
    } catch (error) {
        console.error(error);
        statusMessage.textContent =
            "Unable to extract text. Please try another image.";
    } finally {
        extractButton.disabled = false;
    }
});

// Copy the extracted text
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
        statusMessage.textContent =
            "Select the text and copy it manually.";
    }
});

// Download the extracted text as a TXT file
downloadButton.addEventListener("click", function () {
    const text = textOutput.value;

    if (!text.trim()) {
        statusMessage.textContent = "There is no text to download.";
        return;
    }

    const file = new Blob([text], {
        type: "text/plain"
    });

    const downloadURL = URL.createObjectURL(file);
    const link = document.createElement("a");

    link.href = downloadURL;
    link.download = "extracted-text.txt";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(downloadURL);

    statusMessage.textContent = "Text file downloaded.";
});

// Clear the app
clearButton.addEventListener("click", function () {
    imageInput.value = "";
    imagePreview.src = "";
    imagePreview.hidden = true;

    textOutput.value = "";
    selectedImage = null;

    extractButton.disabled = true;

    statusMessage.textContent =
        "Upload an image to get started.";
});
