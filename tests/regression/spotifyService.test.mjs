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
