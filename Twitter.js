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

  // Function to add or remove Alt button based on alt attribute
  function updateAltButton(img) {
    if (isEmoji(img)) return;

    const container = img.closest('[aria-modal="true"]') || img.parentElement;
    const existingButton = container.querySelector('.alt-button');
    const altText = img.getAttribute('alt');

    if (isValidAltText(altText)) {
      if (!existingButton) {
        const button = createAltButton(altText);
        // ボタンをimg要素の後に挿入
        img.insertAdjacentElement('afterend', button);
        // ボタンのスタイルを調整
        button.style.position = 'absolute';
        button.style.bottom = '10px';
        button.style.right = '10px';
      }
    } else if (existingButton) {
      existingButton.remove();
    }

    // 画像のスタイルをリセット
    img.style.position = '';
    img.style.opacity = '';
  }

  // Main function to update Alt buttons for all non-emoji images in Tweets
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

  function isEnlargedImage(element) {
    // 拡大表示された画像を特定するためのより具体的な条件
    return element.tagName === 'IMG' && (
      element.closest('[aria-modal="true"]') ||
      element.closest('[role="dialog"]') ||
      element.closest('.css-1dbjc4n.r-aqfbo4.r-1p0dtai.r-1d2f490.r-12vffkv.r-1xcajam.r-zchlnj')
    );
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            if (node.matches('img[alt]:not([alt=""])')) {
              updateAltButton(node);
            } else {
              node.querySelectorAll('img[alt]:not([alt=""])').forEach(updateAltButton);
            }
            // 拡大表示のモーダルが追加された場合
            if (node.matches('[aria-modal="true"], [role="dialog"]')) {
              setTimeout(() => {
                node.querySelectorAll('img').forEach(updateAltButton);
              }, 500); // 少し遅延を入れて確実に画像が読み込まれた後に実行
            }
          }
        });
      } else if (mutation.type === 'attributes' && mutation.attributeName === 'alt') {
        updateAltButton(mutation.target);
      }
    });
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['alt', 'src']
  });

  // Initial run
  window.addEventListener('load', updateAllAltButtons);

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
