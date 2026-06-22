// Please see documentation at https://learn.microsoft.com/aspnet/core/client-side/bundling-and-minification
// for details on configuring this project to bundle and minify static web assets.

document.addEventListener("DOMContentLoaded", function () {
    const body = document.querySelector("body");
    const toastMessage = body.getAttribute("data-toast-message");
    const toastType = body.getAttribute("data-toast-type");

    if (toastMessage) {
        const toastEl = document.getElementById("globalToast");
        const toastBody = document.getElementById("globalToastMessage");
        const btnClose = toastEl.querySelector(".btn-close");

        toastBody.textContent = toastMessage;
        
        // Remove previous background classes
        toastEl.classList.remove("bg-success", "bg-danger", "bg-warning", "bg-info", "text-white", "text-dark", "btn-close-white");

        if (toastType === "success") {
            toastEl.classList.add("bg-success", "text-white");
            btnClose.classList.add("btn-close-white");
        } else if (toastType === "danger") {
            toastEl.classList.add("bg-danger", "text-white");
            btnClose.classList.add("btn-close-white");
        } else if (toastType === "warning") {
            toastEl.classList.add("bg-warning", "text-dark");
        } else {
            toastEl.classList.add("bg-info", "text-white");
            btnClose.classList.add("btn-close-white");
        }

        const toast = new bootstrap.Toast(toastEl, { delay: 4000 });
        toast.show();
    }
});
