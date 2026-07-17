let deferredPrompt = null;

window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;

    const modal = document.getElementById("pwaInstallModal");
    if (modal) {
        modal.classList.add("show");
    }
});

async function installPWA() {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
        console.log("PWA installed");
    }

    deferredPrompt = null;

    const modal = document.getElementById("pwaInstallModal");
    if (modal) {
        modal.classList.remove("show");
    }
}

function closePWAInstall() {
    const modal = document.getElementById("pwaInstallModal");

    if (modal) {
        modal.classList.remove("show");
    }

    localStorage.setItem("hidePWAInstall", Date.now());
}

window.addEventListener("load", () => {
    const lastHidden = localStorage.getItem("hidePWAInstall");

    if (lastHidden) {
        const days =
            (Date.now() - Number(lastHidden)) / (1000 * 60 * 60 * 24);

        if (days < 7) return;
    }
});