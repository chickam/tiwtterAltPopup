// ==UserScript==
// @name         Twitter Alt Popup
// @namespace    http://tampermonkey.net/
// @version      2.7
// @description  Displays alt text in a popup for non-emoji images in Tweets on Twitter and allows copying to clipboard.
// @author       Your Name
// @match        *://*.x.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  // Function to create an Alt button
  function createAltButton(altText) {
    const button = document.createElement('button');
    button.className = 'alt-button';
    button.innerText = 'Alt';

    // Create popup container
    const popup = document.createElement('div');
    popup.className = 'alt-popup';
    popup.innerHTML = `
        <div class="alt-popup-content">
            <p>${altText}</p>
            <div class="alt-popup-buttons">
                <button class="alt-copy-button">Copy</button>
                <button class="alt-close-button">Close</button>
            </div>
        </div>
    `;

    // Create a wrapper for the popup
    const popupWrapper = document.createElement('div');
    popupWrapper.className = 'alt-popup-wrapper';
    popupWrapper.appendChild(popup);

    document.body.appendChild(popupWrapper);

    // Function to close the popup
    const closePopup = () => {
      popupWrapper.style.display = 'none';
    };

    // Add click event to the button to toggle popup
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      popupWrapper.style.display = popupWrapper.style.display === 'none' || popupWrapper.style.display === '' ? 'flex' : 'none';
    });

    // Add click event to the copy button in the popup
    popup.querySelector('.alt-copy-button').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      navigator.clipboard.writeText(altText).then(() => {
        console.log('Alt text copied to clipboard');
      }).catch(err => {
        console.error('Failed to copy alt text: ', err);
      });
    });

    // Add click event to the close button
    popup.querySelector('.alt-close-button').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closePopup();
    });

    // Close popup when clicking outside
    popupWrapper.addEventListener('click', (e) => {
      if (e.target === popupWrapper) {
        closePopup();
      }
    });

    return button;
  }
  // Function to check if alt text is valid
  function isValidAltText(alt) {
    return alt && alt.trim() !== '' && alt !== '画像' && alt !== 'Image';
  }

  // Function to check if an image is likely an emoji
  function isEmoji(img) {
    const size = 48; // Maximum size for an emoji in pixels
    return img.width <= size && img.height <= size;
  }
  // Function to check if an image is a profile picture
  function isProfilePicture(img) {
    // プロフィール画像を特定する条件を追加
    return img.closest('a[href^="/"]') !== null ||
      img.closest('[data-testid="UserAvatar-Container-"]') !== null ||
      img.src.includes('profile_images');
  }
  // Function to check if an image should have an Alt button
  function shouldHaveAltButton(img) {
    return img.tagName === 'IMG' &&
      !isEmoji(img) &&
      !isProfilePicture(img) &&
      isValidAltText(img.getAttribute('alt'));
  }
  // Utility function to safely get elements
  function safeQuerySelector(element, selector) {
    try {
      return element.querySelector(selector);
    } catch (e) {
      console.error('Error in safeQuerySelector:', e);
      return null;
    }
  }

  // Function to check if an element is an enlarged image
  function isEnlargedImage(element) {
    if (!element || !element.tagName) return false;
    return element.tagName === 'IMG' && (
      element.closest('[aria-modal="true"]') ||
      element.closest('[role="dialog"]') ||
      element.closest('.css-1dbjc4n.r-aqfbo4.r-1p0dtai.r-1d2f490.r-12vffkv.r-1xcajam.r-zchlnj')
    );
  }
  // Function to add or remove Alt button based on alt attribute
  function updateAltButton(img) {
    if (!img || !img.tagName || !shouldHaveAltButton(img)) return;

    const container = img.closest('[aria-modal="true"], [role="dialog"]') || img.parentElement;
    if (!container) return;

    let existingButton = safeQuerySelector(container, `.alt-button[data-img-src="${img.src}"]`);
    const altText = img.getAttribute('alt');

    if (!existingButton) {
      try {
        const button = createAltButton(altText);
        button.setAttribute('data-img-src', img.src);
        container.appendChild(button);
        positionAltButton(button, img);
      } catch (e) {
        console.error('Error creating Alt button:', e);
      }
    } else {
      positionAltButton(existingButton, img);
    }
  }
  // Main function to update Alt buttons for all non-emoji images
  function updateAllAltButtons() {
    const allImages = document.querySelectorAll('img[alt]:not([alt=""])');
    allImages.forEach(img => {
      if (img.complete) {
        updateAltButton(img);
      } else {
        img.addEventListener('load', () => updateAltButton(img));
      }
    });
  }
  // Altボタンの位置を設定する関数
  function positionAltButton(button, img) {
    if (!button || !img) return;

    const rect = img.getBoundingClientRect();
    const containerRect = img.closest('[aria-modal="true"], [role="dialog"]')?.getBoundingClientRect() || { top: 0, left: 0 };

    button.style.position = 'absolute';
    button.style.top = `${Math.max(rect.bottom - containerRect.top - button.offsetHeight - 10, 0)}px`;
    button.style.left = `${Math.max(rect.right - containerRect.left - button.offsetWidth - 10, 0)}px`;
    button.style.zIndex = '9999'; // Ensure the button is on top
  }
  // 拡大表示モーダルを監視する関数
  // Function to observe enlarged image modal
  function observeEnlargedImageModal(modalElement) {
    if (!modalElement) return;

    const modalObserver = new MutationObserver((mutations) => {
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

    return modalObserver;
  }

  // Observe DOM changes
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            if (node.matches('img') && shouldHaveAltButton(node)) {
              updateAltButton(node);
            } else {
              node.querySelectorAll('img').forEach(img => {
                if (shouldHaveAltButton(img)) updateAltButton(img);
              });
            }
            // Check for enlarged image modal
            if (node.matches('[aria-modal="true"], [role="dialog"]')) {
              setTimeout(() => {
                node.querySelectorAll('img').forEach(img => {
                  if (shouldHaveAltButton(img)) updateAltButton(img);
                });
                observeEnlargedImageModal(node);
              }, 500);
            }
          }
        });
      } else if (mutation.type === 'attributes' && mutation.attributeName === 'alt') {
        if (shouldHaveAltButton(mutation.target)) updateAltButton(mutation.target);
      }
    });
  });


  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['alt', 'src']
  });

  // Initial run
  window.addEventListener('load', () => {
    document.querySelectorAll('img').forEach(img => {
      if (shouldHaveAltButton(img)) updateAltButton(img);
    });
  });

  // Debug function to check why buttons are not showing
  function debugAltButtons() {
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      console.log('Image:', img);
      console.log('Is emoji:', isEmoji(img));
      console.log('Is profile picture:', isProfilePicture(img));
      console.log('Has valid alt text:', isValidAltText(img.getAttribute('alt')));
      console.log('Should have alt button:', shouldHaveAltButton(img));
      console.log('---');
    });
  }

  // Run debug function after a short delay
  setTimeout(debugAltButtons, 2000);

  // Apply styles for the Alt button and popup
  // Apply styles for the Alt button and popup
  const styles = `
.alt-button {
    background-color: rgba(255, 69, 0, 0.8);
    color: white;
    border: 2px solid rgba(255, 0, 0, 0.8);
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 14px;
    cursor: pointer;
    z-index: 10000; // z-indexを上げて確実に表示されるように
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
