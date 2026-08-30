export async function waitForProgrammaticRenderReady({
  config = null,
  debugMode = false,
  renderReady = null,
} = {}) {
  if (renderReady == null || renderReady === '') {
    return;
  }

  debugMode && console.info('[HTML2PDF4DOC] Waiting for renderReady.');

  const renderReadyValue = resolveRenderReadyValue({
    config,
    renderReady,
  });

  await waitForRenderReadyValue(renderReadyValue);

  debugMode && console.info('[HTML2PDF4DOC] renderReady completed.');
}

function resolveRenderReadyValue({
  config,
  renderReady,
}) {
  if (typeof renderReady !== 'function') {
    return renderReady;
  }

  return renderReady({
    config,
    document: window.document,
    window,
  });
}

async function waitForRenderReadyValue(renderReadyValue) {
  if (Array.isArray(renderReadyValue)) {
    await Promise.all(renderReadyValue);
    return;
  }

  await Promise.resolve(renderReadyValue);
}
