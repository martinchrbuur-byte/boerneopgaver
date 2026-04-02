/**
 * Test: P3 & P5 Services (Error Visibility & Orphaned Records)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrphanedRecordService } from '../../src/services/orphanedRecordService.js';
import { createCorruptionRecoveryService } from '../../src/services/corruptionRecoveryService.js';

test('P5: Orphaned Records - finds records with non-existent choreIds', async () => {
  const service = createOrphanedRecordService();
  
  const chores = [
    { id: 'chore-1', name: 'Valid' },
    { id: 'chore-2', name: 'Also Valid' }
  ];
  
  const records = [
    { choreId: 'chore-1', earnedValue: 50 },
    { choreId: 'chore-2', earnedValue: 50 },
    { choreId: 'chore-3-DELETED', earnedValue: 100 }, // ORPHANED
    { choreId: 'chore-4-DELETED', earnedValue: 75 }   // ORPHANED
  ];
  
  const orphaned = service.findOrphanedRecords(chores, records);
  
  console.log('✓ Found orphaned records:', orphaned.length);
  assert.equal(orphaned.length, 2, 'Should find 2 orphaned records');
  assert.equal(orphaned[0].choreId, 'chore-3-DELETED');
  assert.equal(orphaned[1].choreId, 'chore-4-DELETED');
});

test('P5: Orphaned Records - cleans records and tracks counts', async () => {
  const service = createOrphanedRecordService();
  
  const chores = [
    { id: 'chore-1', name: 'Active' }
  ];
  
  const records = [
    { choreId: 'chore-1', earnedValue: 50 },
    { choreId: 'deleted-1', earnedValue: 100 },
    { choreId: 'deleted-2', earnedValue: 75 }
  ];
  
  const result = service.cleanOrphanedRecords(chores, records);
  
  console.log('✓ Cleanup result:', {
    cleaned: result.cleaned.length,
    orphaned: result.orphanedCount
  });
  
  assert.equal(result.cleaned.length, 1, 'Should keep 1 record');
  assert.equal(result.orphanedCount, 2, 'Should identify 2 orphaned');
  assert.equal(result.hasOrphans, true);
});

test('P5: Orphaned Records - summarizes orphaned data by kid', async () => {
  const service = createOrphanedRecordService();
  
  const chores = [{ id: 'chore-1', name: 'Active' }];
  
  const records = [
    { choreId: 'chore-1', earnedValue: 50, completedBy: 'kid-1' },
    { choreId: 'deleted-1', earnedValue: 100, completedBy: 'kid-1' },
    { choreId: 'deleted-2', earnedValue: 75, completedBy: 'kid-2' }
  ];
  
  const summary = service.getOrphanedSummary(chores, records);
  
  console.log('✓ Orphaned summary:', {
    count: summary.count,
    totalValue: summary.orphanedValue,
    byKid: summary.byKid
  });
  
  assert.equal(summary.count, 2);
  assert.equal(summary.orphanedValue, 175);
  assert.equal(summary.byKid['kid-1'], 100);
  assert.equal(summary.byKid['kid-2'], 75);
});

test('P3: Corruption Recovery - validates correct JSON structure', async () => {
  const service = createCorruptionRecoveryService();
  
  const validData = JSON.stringify({
    chores: [{ id: '1', name: 'Test' }],
    records: []
  });
  
  const result = service.validateStoredData(validData, 'test-key');
  
  console.log('✓ Valid data validation:', result.isValid);
  assert.equal(result.isValid, true);
  assert.equal(result.isCorrupted, false);
});

test('P3: Corruption Recovery - detects corrupted JSON', async () => {
  const service = createCorruptionRecoveryService();
  
  const corruptedData = '{bad json}';
  
  const result = service.validateStoredData(corruptedData, 'test-key');
  
  console.log('✓ Corrupted data detection:', result.isCorrupted);
  assert.equal(result.isValid, false);
  assert.equal(result.isCorrupted, true);
  assert(result.reason.includes('parse error'));
});

test('P3: Corruption Recovery - detects missing required arrays', async () => {
  const service = createCorruptionRecoveryService();
  
  const missingArrays = JSON.stringify({
    chores: [{ id: '1' }]
    // Missing records array
  });
  
  const result = service.validateStoredData(missingArrays, 'test-key');
  
  console.log('✓ Missing arrays detection:', result.isCorrupted);
  assert.equal(result.isValid, false);
  assert.equal(result.isCorrupted, true);
});

test('P3: Corruption Recovery - attempts recovery of partial data', async () => {
  const service = createCorruptionRecoveryService();
  
  const partialData = {
    chores: [
      { id: '1', name: 'Chore 1' },
      { id: '2', name: 'Chore 2' }
    ],
    records: [
      { id: 'r1', choreId: '1', earnedValue: 50 }
    ]
    // Missing other required fields
  };
  
  const recovered = service.attemptRecovery(partialData);
  
  console.log('✓ Recovery result:', {
    chores: recovered.chores.length,
    records: recovered.records.length
  });
  
  assert.equal(recovered.chores.length, 2);
  assert.equal(recovered.records.length, 1);
  assert.equal(recovered.ui.activeRole, 'parent'); // Default value
});

console.log('\n✅ P3 & P5 tests complete');
