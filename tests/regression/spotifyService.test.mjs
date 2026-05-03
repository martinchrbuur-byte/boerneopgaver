import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpotifyService } from '../../src/services/spotifyService.js';

test('refreshRecommendations places liked songs first', async () => {
  const payload = {
    connected: true,
    items: [
      { id: 'a', title: 'Track Mix', uri: 'spotify:playlist:a', kind: 'playlist' },
      { id: 'b', title: 'Daily Mix', uri: 'spotify:playlist:b', kind: 'playlist' },
      { id: 'liked', title: 'Liked Songs', uri: 'spotify:collection', kind: 'playlist' },
      { id: 'c', title: 'New Releases', uri: 'spotify:playlist:c', kind: 'playlist' }
    ]
  };

  const service = createSpotifyService({
    spotifyConfig: {
      recommendationsEndpoint: 'https://example.com/recommendations',
      connectUrl: 'https://example.com/connect'
    },
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => payload
    }),
    navigatorRef: { onLine: true }
  });

  await service.refreshRecommendations();
  const state = service.getTileState();

  assert.equal(state.items[0]?.title, 'Liked Songs');
});

test('refreshRecommendations keeps liked songs in top 6 by prioritizing before slice', async () => {
  const payload = {
    connected: true,
    items: [
      { id: '1', title: 'Rec 1', uri: 'spotify:playlist:1', kind: 'playlist' },
      { id: '2', title: 'Rec 2', uri: 'spotify:playlist:2', kind: 'playlist' },
      { id: '3', title: 'Rec 3', uri: 'spotify:playlist:3', kind: 'playlist' },
      { id: '4', title: 'Rec 4', uri: 'spotify:playlist:4', kind: 'playlist' },
      { id: '5', title: 'Rec 5', uri: 'spotify:playlist:5', kind: 'playlist' },
      { id: '6', title: 'Rec 6', uri: 'spotify:playlist:6', kind: 'playlist' },
      { id: 'liked', title: 'Sange, du synes om', uri: 'spotify:collection:tracks', kind: 'playlist' },
      { id: '7', title: 'Rec 7', uri: 'spotify:playlist:7', kind: 'playlist' }
    ]
  };

  const service = createSpotifyService({
    spotifyConfig: {
      recommendationsEndpoint: 'https://example.com/recommendations',
      connectUrl: 'https://example.com/connect'
    },
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => payload
    }),
    navigatorRef: { onLine: true }
  });

  await service.refreshRecommendations();
  const state = service.getTileState();

  assert.equal(state.items.length, 6);
  assert.equal(state.items[0]?.title, 'Sange, du synes om');
  assert.ok(state.items.some((item) => item.title === 'Sange, du synes om'));
  assert.ok(!state.items.some((item) => item.title === 'Rec 6'));
});

test('refreshRecommendations injects liked songs first when API does not return it', async () => {
  const payload = {
    connected: true,
    items: [
      { id: '1', title: 'Rec 1', uri: 'spotify:playlist:1', kind: 'playlist' },
      { id: '2', title: 'Rec 2', uri: 'spotify:playlist:2', kind: 'playlist' }
    ]
  };

  const service = createSpotifyService({
    spotifyConfig: {
      recommendationsEndpoint: 'https://example.com/recommendations',
      connectUrl: 'https://example.com/connect'
    },
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => payload
    }),
    navigatorRef: { onLine: true }
  });

  await service.refreshRecommendations();
  const state = service.getTileState();

  assert.equal(state.items[0]?.title, 'Sange, du synes om');
  assert.equal(state.items[0]?.uri, 'spotify:collection:tracks');
  assert.equal(state.items[1]?.title, 'Rec 1');
});

test('refreshDevices prioritizes speakers and selects the active speaker', async () => {
  const fetchCalls = [];
  const service = createSpotifyService({
    spotifyConfig: {
      recommendationsEndpoint: 'https://example.com/recommendations',
      playbackEndpoint: 'https://example.com/playback',
      connectUrl: 'https://example.com/connect'
    },
    fetchImpl: async (url, options = {}) => {
      fetchCalls.push({ url, options });
      if (url === 'https://example.com/recommendations') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ connected: true, items: [] })
        };
      }

      if (url === 'https://example.com/playback') {
        const body = JSON.parse(options.body || '{}');
        if (body.action === 'devices') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              devices: [
                { id: 'phone', name: 'Telefon', type: 'Smartphone', isActive: false },
                { id: 'speaker-1', name: 'Stue', type: 'Speaker', isActive: true },
                { id: 'desktop', name: 'Computer', type: 'Computer', isActive: false }
              ]
            })
          };
        }
      }

      throw new Error(`Unexpected request: ${url}`);
    },
    navigatorRef: { onLine: true }
  });

  await service.refreshRecommendations();
  const state = await service.refreshDevices();

  assert.equal(state.devices.length, 1);
  assert.equal(state.devices[0]?.id, 'speaker-1');
  assert.equal(state.selectedDeviceId, 'speaker-1');
  assert.equal(state.canControlPlayback, true);
  assert.equal(state.showingAllDevices, false);
  assert.ok(fetchCalls.some((call) => call.url === 'https://example.com/playback'));
});

test('refreshDevices falls back to all devices when no speakers are visible', async () => {
  const service = createSpotifyService({
    spotifyConfig: {
      recommendationsEndpoint: 'https://example.com/recommendations',
      playbackEndpoint: 'https://example.com/playback',
      connectUrl: 'https://example.com/connect'
    },
    fetchImpl: async (url, options = {}) => {
      if (url === 'https://example.com/recommendations') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ connected: true, items: [] })
        };
      }

      if (url === 'https://example.com/playback') {
        const body = JSON.parse(options.body || '{}');
        if (body.action === 'devices') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              devices: [
                { id: 'phone', name: 'Telefon', type: 'Smartphone', isActive: true },
                { id: 'desktop', name: 'Computer', type: 'Computer', isActive: false }
              ]
            })
          };
        }
      }

      throw new Error(`Unexpected request: ${url}`);
    },
    navigatorRef: { onLine: true }
  });

  await service.refreshRecommendations();
  const state = await service.refreshDevices();

  assert.equal(state.devices.length, 2);
  assert.equal(state.showingAllDevices, true);
  assert.equal(state.selectedDeviceId, 'phone');
  assert.match(state.deviceMessage, /fallback/i);
});

test('selectPlaybackDevice transfers playback and enables controls without browser SDK readiness', async () => {
  const playbackRequests = [];
  const service = createSpotifyService({
    spotifyConfig: {
      recommendationsEndpoint: 'https://example.com/recommendations',
      playbackEndpoint: 'https://example.com/playback',
      connectUrl: 'https://example.com/connect'
    },
    fetchImpl: async (url, options = {}) => {
      if (url === 'https://example.com/recommendations') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ connected: true, items: [] })
        };
      }

      if (url === 'https://example.com/playback') {
        const body = JSON.parse(options.body || '{}');
        playbackRequests.push(body);

        if (body.action === 'devices') {
          return {
            ok: true,
            status: 200,
            json: async () => ({ ok: true, devices: [{ id: 'speaker-1', name: 'Stue', type: 'Speaker', isActive: false }] })
          };
        }

        if (body.action === 'transfer') {
          return {
            ok: true,
            status: 200,
            json: async () => ({ ok: true })
          };
        }
      }

      throw new Error(`Unexpected request: ${url}`);
    },
    navigatorRef: { onLine: true }
  });

  await service.refreshRecommendations();
  await service.refreshDevices();
  const result = await service.selectPlaybackDevice('speaker-1');
  const state = service.getTileState();

  assert.equal(result.ok, true);
  assert.equal(state.selectedDeviceId, 'speaker-1');
  assert.equal(state.canControlPlayback, true);
  assert.equal(state.playerReady, false);
  assert.equal(state.isPlaying, true);
  assert.deepEqual(playbackRequests.at(-1), { action: 'transfer', deviceId: 'speaker-1', play: true });
});
