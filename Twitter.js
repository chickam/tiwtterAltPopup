// ==UserScript==
// @name         Twitter Alt Popup
// @namespace    http://tampermonkey.net/
// @version      4.1
// @description  Displays alt text in a popup for non-emoji images in Tweets on Twitter and allows copying to clipboard.
// @author       Your Name
// @match        *://*.x.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const CONSTANTS = {
    EMOJI_MAX_SIZE: 48,
    INVALID_ALT_TEXT: ['画像', 'Image'],
    BUTTON_TEXT: 'Alt',
    COPY_BUTTON_TEXT: 'Copy',
    CLOSE_BUTTON_TEXT: 'Close',
    POPUP_DISPLAY_DELAY: 500,
    MODAL_CHECK_INTERVAL: 100,
  };

  function createPopup(altText) {
    const popup = document.createElement('div');
    popup.className = 'alt-popup';
    popup.innerHTML = `
      <div class="alt-popup-content">
        <p>${altText}</p>
        <div class="alt-popup-buttons">
          <button class="alt-copy-button">${CONSTANTS.COPY_BUTTON_TEXT}</button>
          <button class="alt-close-button">${CONSTANTS.CLOSE_BUTTON_TEXT}</button>
        </div>
      </div>
    `;
    return popup;
  }

  function createPopupWrapper(popup) {
    const wrapper = document.createElement('div');
    wrapper.className = 'alt-popup-wrapper';
    wrapper.appendChild(popup);
    document.body.appendChild(wrapper);
    return wrapper;
  }

  function createAltButton(altText) {
    const button = document.createElement('button');
    button.className = 'alt-button';
    button.innerText = CONSTANTS.BUTTON_TEXT;

    const popup = createPopup(altText);
    const popupWrapper = createPopupWrapper(popup);

    setupButtonEvents(button, popupWrapper);
    setupPopupEvents(popup, popupWrapper, altText);

    return button;
  }

  function setupButtonEvents(button, popupWrapper) {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      togglePopup(popupWrapper);
    });
  }

  function setupPopupEvents(popup, popupWrapper, altText) {
    const copyButton = popup.querySelector('.alt-copy-button');
    const closeButton = popup.querySelector('.alt-close-button');

    copyButton.addEventListener('click', (e) => handleCopyClick(e, altText));
    closeButton.addEventListener('click', (e) => handleCloseClick(e, popupWrapper));
    popupWrapper.addEventListener('click', (e) => {
      if (e.target === popupWrapper) {
        closePopup(popupWrapper);
      }
    });
  }

  function togglePopup(popupWrapper) {
    popupWrapper.style.display = popupWrapper.style.display === 'none' || popupWrapper.style.display === '' ? 'flex' : 'none';
  }

  function closePopup(popupWrapper) {
    popupWrapper.style.display = 'none';
  }

  function handleCopyClick(e, altText) {
    e.preventDefault();
    e.stopPropagation();
    copyToClipboard(altText);
  }

  function handleCloseClick(e, popupWrapper) {
    e.preventDefault();
    e.stopPropagation();
    closePopup(popupWrapper);
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
      .then(() => console.log('Alt text copied to clipboard'))
      .catch(err => console.error('Failed to copy alt text: ', err));
  }

  function isValidAltText(alt) {
    return alt && alt.trim() !== '' && !CONSTANTS.INVALID_ALT_TEXT.includes(alt);
  }

  function isEmoji(img) {
    return img.width <= CONSTANTS.EMOJI_MAX_SIZE && img.height <= CONSTANTS.EMOJI_MAX_SIZE;
  }

  function updateAltButton(img) {
    if (isEmoji(img)) return;

    const existingButton = img.nextSibling && img.nextSibling.classList && img.nextSibling.classList.contains('alt-button');
    const altText = img.getAttribute('alt');

    if (isValidAltText(altText)) {
      if (!existingButton) {
        const button = createAltButton(altText);
        img.insertAdjacentElement('afterend', button);
        setButtonPosition(button);
      }
    } else if (existingButton) {
      img.nextSibling.remove();
    }
  }

  function setButtonPosition(button) {
    button.style.position = 'absolute';
    button.style.bottom = '10px';
    button.style.right = '10px';
  }

  function updateAllAltButtons() {
    const allImages = document.querySelectorAll('img[alt]:not([alt=""])');
    allImages.forEach(processImage);

    const modalImages = document.querySelectorAll('[aria-modal="true"] img, [role="dialog"] img');
    modalImages.forEach(updateAltButton);
  }

  function processImage(img) {
    if (img.complete) {
      updateAltButton(img);
    } else {
      img.addEventListener('load', () => updateAltButton(img));
    }
  }

  let modalObserver = null;

  function handleModalOpen(modalElement) {
    if (modalObserver) {
      modalObserver.disconnect();
    }

    modalObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' || mutation.type === 'attributes') {
          const images = modalElement.querySelectorAll('img[alt]:not([alt=""])');
          images.forEach(updateAltButton);
        }
      });
    });

    modalObserver.observe(modalElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['alt', 'src']
    });

    // 初回の画像に対してAltボタンを追加
    const initialImages = modalElement.querySelectorAll('img[alt]:not([alt=""])');
    initialImages.forEach(updateAltButton);
  }
  function handleModalClose() {
    if (modalObserver) {
      modalObserver.disconnect();
      modalObserver = null;
    }
  }

  function checkForModalChanges() {
    const modalElement = document.querySelector('[aria-modal="true"], [role="dialog"]');
    if (modalElement) {
      handleModalOpen(modalElement);
    } else {
      handleModalClose();
    }
  }
  setInterval(checkForModalChanges, CONSTANTS.MODAL_CHECK_INTERVAL);

  const observer = new MutationObserver(handleMutations);

  function handleMutations(mutations) {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        handleChildListMutation(mutation);
      } else if (mutation.type === 'attributes' && mutation.attributeName === 'alt') {
        updateAltButton(mutation.target);
      }
    });
  }

  function handleChildListMutation(mutation) {
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType === 1) {
        if (node.matches('img[alt]:not([alt=""])')) {
          updateAltButton(node);
        } else if (node.matches('[data-testid="tweet"], [role="link"]')) {
          setTimeout(() => {
            node.querySelectorAll('img').forEach(updateAltButton);
          }, CONSTANTS.POPUP_DISPLAY_DELAY);
        } else if (node.matches('[aria-modal="true"], [role="dialog"]')) {
          handleModalOpen(node);
        }
      }
    });
  }
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['alt', 'src']
  });

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-testid="tweet"], [role="link"]')) {
      setTimeout(updateAllAltButtons, CONSTANTS.POPUP_DISPLAY_DELAY);
    }
  });

  window.addEventListener('load', updateAllAltButtons);

  const styles = `
.alt-button {
    background-color: rgba(255, 69, 0, 0.8);
    color: white;
    border: 2px solid rgba(255, 0, 0, 0.8);
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 14px;
    cursor: pointer;
    z-index: 10000;
    position: absolute;
    bottom: 10px;
    right: 10px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
}
.alt-button:hover {
    background-color: rgba(255, 87, 34, 0.9);
    border-color: rgba(204, 0, 0, 0.9);
}
.alt-popup-wrapper {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 10000;
    justify-content: center;
    align-items: center;
}
.alt-popup {
    background-color: white;
    color: black;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.3);
    width: 80%;
    max-width: 600px;
    max-height: 80%;
    overflow-y: auto;
}
.alt-popup-content {
    display: flex;
    flex-direction: column;
    align-items: center;
}
.alt-popup-content p {
    margin: 0 0 20px 0;
    font-size: 16px;
    line-height: 1.5;
    text-align: left;
    width: 100%;
}
.alt-popup-buttons {
    display: flex;
    justify-content: center;
    gap: 10px;
}
.alt-copy-button, .alt-close-button {
    background-color: #1da1f2;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 10px 20px;
    font-size: 14px;
    cursor: pointer;
    transition: background-color 0.2s;
}
.alt-copy-button:hover, .alt-close-button:hover {
    background-color: #0c85d0;
}
.alt-close-button {
    background-color: #e0245e;
}
.alt-close-button:hover {
    background-color: #c51f5d;
}
`;
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);

})();