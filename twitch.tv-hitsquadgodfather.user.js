// ==UserScript==
// @name            Twitch - hitsquadgodfather
// @namespace       ngoclong19.github.io
// @version         0.1.0
// @description     🤖 Auto send chat commands on button click!
// @description:vi  🤖 Tự động gửi lệnh trò chuyện khi nhấp vào nút!
// @author          ngoclong19
// @match           https://www.twitch.tv/hitsquadgodfather
// @icon            https://www.twitch.tv/favicon.ico
// @grant           none
// @source          https://github.com/ngoclong19/userscripts
// @require         https://cdn.jsdelivr.net/npm/eventemitter3@5.0.1/dist/eventemitter3.umd.min.js
// ==/UserScript==

// References
// https://github.com/night/betterttv/blob/e60337f43371475254a52c248610c65b6cd802c0/src/modules/emote_menu/twitch/EmoteMenu.jsx
// https://github.com/night/betterttv/blob/b544aee0395f04af17521fd936b79da9a0755b94/src/observers/dom.js
// https://github.com/night/betterttv/blob/24f21e5595e105694038ade472229e0798e10b1c/src/utils/safe-event-emitter.js
// https://github.com/night/betterttv/blob/0ee4e02a7e22d633d6fe1d7bc7ecf7fb1f67eaf0/src/utils/twitch.js

'use strict';

/* global globalThis */

(function () {
  const EventEmitter = globalThis.EventEmitter3; // from npm package eventemitter3

  const CHAT_CONTAINER =
    'section[data-test-selector="chat-room-component-layout"]';
  const CHAT_SETTINGS_BUTTON_CONTAINER_SELECTOR =
    '.chat-input div[data-test-selector="chat-input-buttons-container"]';
  const IGNORED_HTML_TAGS = new Set([
    'BR',
    'HEAD',
    'LINK',
    'META',
    'SCRIPT',
    'STYLE',
  ]);

  // const MSG_INTERVAL = 500 * 5;

  let observer;
  const observedIds = Object.create(null);
  const observedClassNames = Object.create(null);
  const observedTestSelectors = Object.create(null);
  const attributeObservers = new Map();

  /**
   * @param {HTMLElement} element
   * @returns {Object | null}
   */
  const getReactInstance = (element) => {
    for (const key in element) {
      if (key.startsWith('__reactInternalInstance$')) {
        return /** @type {Object} */ (
          element[/** @type {keyof HTMLElement} */ (key)]
        );
      }
    }

    return null;
  };

  const searchReactParents = (node, predicate, maxDepth = 15, depth = 0) => {
    try {
      if (predicate(node)) {
        return node;
      }
    } catch (_) {}

    if (!node || depth > maxDepth) {
      return null;
    }

    const { return: parent } = node;
    if (parent) {
      return searchReactParents(parent, predicate, maxDepth, depth + 1);
    }

    return null;
  };

  const getCurrentChat = () => {
    let currentChat;
    try {
      const node = searchReactParents(
        getReactInstance(
          /** @type {HTMLElement} */ (document.querySelector(CHAT_CONTAINER))
        ),
        (n) =>
          n.stateNode && n.stateNode.props && n.stateNode.props.onSendMessage
      );
      currentChat = node.stateNode;
    } catch (_) {}

    return currentChat;
  };

  const sendChatMessage = (message) => {
    const currentChat = getCurrentChat();
    if (!currentChat) return;
    currentChat.props.onSendMessage(message);
  };

  const clickHandler = async () => {
    sendChatMessage('!hitsquad');
  };

  const loadLegacyButton = () => {
    const container = document.querySelector(
      CHAT_SETTINGS_BUTTON_CONTAINER_SELECTOR
    );
    if (container == null) {
      console.log('`container` not found');
      return;
    }

    const rightContainer = container.lastChild;
    const buttonContainer = document.createElement('div');
    rightContainer.insertBefore(buttonContainer, rightContainer.firstChild);

    const button = document.createElement('button');
    // https://fontawesome.com/icons/robot?s=solid&f=classic
    button.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 640 512"><!--! Font Awesome Free 6.4.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. --><path d="M320 0c17.7 0 32 14.3 32 32V96H472c39.8 0 72 32.2 72 72V440c0 39.8-32.2 72-72 72H168c-39.8 0-72-32.2-72-72V168c0-39.8 32.2-72 72-72H288V32c0-17.7 14.3-32 32-32zM208 384c-8.8 0-16 7.2-16 16s7.2 16 16 16h32c8.8 0 16-7.2 16-16s-7.2-16-16-16H208zm96 0c-8.8 0-16 7.2-16 16s7.2 16 16 16h32c8.8 0 16-7.2 16-16s-7.2-16-16-16H304zm96 0c-8.8 0-16 7.2-16 16s7.2 16 16 16h32c8.8 0 16-7.2 16-16s-7.2-16-16-16H400zM264 256a40 40 0 1 0 -80 0 40 40 0 1 0 80 0zm152 40a40 40 0 1 0 0-80 40 40 0 1 0 0 80zM48 224H64V416H48c-26.5 0-48-21.5-48-48V272c0-26.5 21.5-48 48-48zm544 0c26.5 0 48 21.5 48 48v96c0 26.5-21.5 48-48 48H576V224h16z"/></svg>';
    button.style.width = button.style.height = '2rem';
    button.firstChild.style.fill = 'currentcolor';
    button.onclick = clickHandler;

    buttonContainer.append(button);
  };

  const newListener = (listener, ...args) => {
    try {
      listener(...args);
    } catch (e) {
      console.error('Failed executing listener callback', e.stack);
    }
  };

  const parseSelector = (selector) => {
    const partialSelectors = selector.split(',').map((s) => s.trim());
    const ids = [];
    const classNames = [];
    const testSelectors = [];
    for (const partialSelector of partialSelectors) {
      if (partialSelector.startsWith('#')) {
        ids.push({
          key: partialSelector.split(' ')[0].split('#')[1],
          partialSelector,
        });
      } else if (partialSelector.startsWith('.')) {
        classNames.push({
          key: partialSelector.split(' ')[0].split('.')[1],
          partialSelector,
        });
      } else if (partialSelector.includes('[data-test-selector')) {
        testSelectors.push({
          key: partialSelector
            .split(' ')[0]
            .split('[data-test-selector="')[1]
            .split('"]')[0],
          partialSelector,
        });
      }
    }
    return {
      ids,
      classNames,
      testSelectors,
    };
  };

  const startAttributeObserver = (observedType, emitter, node) => {
    const attributeObserver = new window.MutationObserver(() =>
      emitter.emit(observedType.selector, node, node.isConnected)
    );
    attributeObserver.observe(node, { attributes: true, subtree: true });
    attributeObservers.set(observedType, attributeObserver);
  };

  const stopAttributeObserver = (observedType) => {
    const attributeObserver = attributeObservers.get(observedType);
    if (!attributeObserver) {
      return;
    }

    attributeObserver.disconnect();
    attributeObservers.delete(observedType);
  };

  const processObservedResults = (emitter, target, node, results) => {
    if (!results || results.length === 0) {
      return;
    }

    for (const observedType of results) {
      const { partialSelector, selector, options } = observedType;
      let foundNode = partialSelector.includes(' ')
        ? node.querySelector(selector)
        : node;
      if (!foundNode) {
        continue;
      }
      if (options && options.useParentNode) {
        foundNode = node;
      }
      if (options && options.useTargetNode) {
        foundNode = target;
      }
      const { isConnected } = foundNode;
      if (options && options.attributes) {
        if (isConnected) {
          startAttributeObserver(observedType, emitter, foundNode);
        } else {
          stopAttributeObserver(observedType);
        }
      }
      emitter.emit(selector, foundNode, isConnected);
    }
  };

  const processMutations = (emitter, nodes) => {
    if (!nodes || nodes.length === 0) {
      return;
    }

    for (const [target, node] of nodes) {
      let nodeId = node.id;
      if (typeof nodeId === 'string' && nodeId.length > 0) {
        nodeId = nodeId.trim();
        processObservedResults(emitter, target, node, observedIds[nodeId]);
      }

      let testSelector = node.getAttribute('data-test-selector');
      if (typeof testSelector === 'string' && testSelector.length > 0) {
        testSelector = testSelector.trim();
        processObservedResults(
          emitter,
          target,
          node,
          observedTestSelectors[testSelector]
        );
      }

      const nodeClassList = node.classList;
      if (nodeClassList && nodeClassList.length > 0) {
        for (let className of nodeClassList) {
          className = className.trim();
          processObservedResults(
            emitter,
            target,
            node,
            observedClassNames[className]
          );
        }
      }
    }
  };

  class SafeEventEmitter extends EventEmitter {
    constructor() {
      super();
    }

    on(type, listener) {
      const callback = newListener.bind(this, listener);
      super.on(type, callback);
      return () => super.off(type, callback);
    }
  }

  class DOMObserver extends SafeEventEmitter {
    constructor() {
      super();

      observer = new window.MutationObserver((mutations) => {
        const pendingNodes = [];

        for (const { addedNodes, removedNodes, target } of mutations) {
          if (
            !addedNodes ||
            !removedNodes ||
            (addedNodes.length === 0 && removedNodes.length === 0)
          ) {
            continue;
          }

          for (let i = 0; i < 2; i++) {
            const nodes = i === 0 ? addedNodes : removedNodes;
            for (const node of nodes) {
              if (
                node.nodeType !== Node.ELEMENT_NODE ||
                IGNORED_HTML_TAGS.has(node.nodeName)
              ) {
                continue;
              }

              pendingNodes.push([target, node]);
              if (node.childElementCount === 0) {
                continue;
              }

              for (const childNode of node.querySelectorAll('[id],[class]')) {
                pendingNodes.push([target, childNode]);
              }
            }
          }
        }

        if (pendingNodes.length === 0) {
          return;
        }

        processMutations(this, pendingNodes);
      });
      observer.observe(document, { childList: true, subtree: true });
    }

    on(selector, callback, options) {
      const parsedSelector = parseSelector(selector);

      const initialNodes = [];
      for (const selectorType of Object.keys(parsedSelector)) {
        let observedSelectorType;
        switch (selectorType) {
          case 'ids':
            observedSelectorType = observedIds;
            break;
          case 'classNames':
            observedSelectorType = observedClassNames;
            break;
          case 'testSelectors':
            observedSelectorType = observedTestSelectors;
            break;
          default:
            break;
        }

        for (const { key, partialSelector } of parsedSelector[selectorType]) {
          const currentObservedTypeSelectors = observedSelectorType[key];
          const observedType = { partialSelector, selector, options };
          if (!currentObservedTypeSelectors) {
            observedSelectorType[key] = [observedType];
          } else {
            currentObservedTypeSelectors.push(observedType);
          }

          if (observedSelectorType === observedIds) {
            initialNodes.push(...document.querySelectorAll(`#${key}`));
          } else if (observedSelectorType === observedClassNames) {
            initialNodes.push(...document.getElementsByClassName(key));
          }
        }
      }

      const result = super.on(selector, callback);

      // trigger dom mutations for existing elements for on page
      processMutations(
        this,
        initialNodes.map((node) => [node.parentElement, node])
      );

      return result;
    }
  }

  const domObserver = new DOMObserver();

  domObserver.on(
    CHAT_SETTINGS_BUTTON_CONTAINER_SELECTOR,
    (_node, isConnected) => {
      if (!isConnected) {
        return;
      }

      loadLegacyButton();
    }
  );
})();
