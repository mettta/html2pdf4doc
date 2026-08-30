import { expect } from 'chai';
import { JSDOM } from 'jsdom';
import App from '../../src/app.js';
import buildAppConfig from '../../src/appConfig.js';
import { waitForProgrammaticRenderReady } from '../../src/renderReady.js';

describe('App class', () => {
  let dom;

  beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`);
    global.window = dom.window;
    global.document = dom.window.document;
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
  });

  describe('constructor', () => {
    it('should correctly initialize properties in the constructor', () => {
      const params = { debugMode: true, preloader: 'true' };
      const app = new App(params);

      expect(app.params).to.deep.equal(params);
      expect(app.debugMode).to.be.true;
      expect(app.preloader).to.equal('true');
      expect(app.selector).to.exist;
    });
  });

  describe('buildAppConfig', () => {
    it('enables asserts and markup flags when forced debug mode is active', () => {
      const params = { forcedDebugMode: 'true' };
      const builtConfig = buildAppConfig(params);

      expect(builtConfig.forcedDebugMode).to.be.true;
      expect(builtConfig.debugMode).to.be.true;
      expect(builtConfig.consoleAssert).to.be.true;
      expect(builtConfig.markupDebugMode).to.be.true;
      expect(builtConfig.debugConfig.testSignals.forcedModeLog).to.be.true;
    });

    it('keeps test signal disabled without forced debug mode', () => {
      const params = { debugMode: 'true' };
      const builtConfig = buildAppConfig(params);

      expect(builtConfig.forcedDebugMode).to.be.false;
      expect(builtConfig.debugMode).to.be.true;
      expect(builtConfig.consoleAssert).to.be.false;
      expect(builtConfig.markupDebugMode).to.be.false;
      expect(builtConfig.debugConfig.testSignals.forcedModeLog).to.be.false;
    });
  });

  describe('waitForProgrammaticRenderReady', () => {
    it('does nothing when renderReady is not defined', async () => {
      await waitForProgrammaticRenderReady();
    });

    it('awaits a promise', async () => {
      let resolved = false;
      const renderReady = new Promise(resolve => {
        setTimeout(() => {
          resolved = true;
          resolve();
        }, 0);
      });

      await waitForProgrammaticRenderReady({ renderReady });

      expect(resolved).to.be.true;
    });

    it('awaits a function', async () => {
      let receivedConfig = null;
      const renderReady = ({ config }) => {
        receivedConfig = config;
        return Promise.resolve();
      };

      const config = { debugMode: false };
      await waitForProgrammaticRenderReady({ config, renderReady });

      expect(receivedConfig).to.equal(config);
    });

    it('awaits an array of promises', async () => {
      const resolved = [];
      const renderReady = [
        Promise.resolve().then(() => resolved.push('first')),
        Promise.resolve().then(() => resolved.push('second')),
      ];

      await waitForProgrammaticRenderReady({ renderReady });

      expect(resolved).to.have.members(['first', 'second']);
    });
  });

});
