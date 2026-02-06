"use client";

/**
 * Responsibility:
 * - Compute an optimal 1:1 assignment for a square cost matrix (minimization).
 *
 * Notes:
 * - Implements the Hungarian algorithm in O(n^3).
 * - Intended for small matrices (e.g., <= 25) used by face tracking.
 */

const LARGE_FINITE_COST = 1_000_000;

function assertSquareCostMatrix(costMatrix: number[][]): void {
  // Guard: must be a non-empty square matrix.
  if (!Array.isArray(costMatrix) || costMatrix.length === 0) {
    throw new Error("Cost matrix must be a non-empty square matrix");
  }

  const size = costMatrix.length;
  for (const row of costMatrix) {
    if (!Array.isArray(row) || row.length !== size) {
      throw new Error("Cost matrix must be square (same row length)");
    }
    for (const value of row) {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error("Cost matrix must contain only finite numbers");
      }
    }
  }
}

function toFiniteCost(value: number): number {
  if (!Number.isFinite(value)) return LARGE_FINITE_COST;
  return value;
}

/**
 * Returns an assignment array where `assignment[rowIndex] = columnIndex`.
 */
export function solveHungarianAssignment(costMatrix: number[][]): number[] {
  assertSquareCostMatrix(costMatrix);

  const size = costMatrix.length;
  // 1-indexed implementation (classic shortest augmenting path version).
  const u = new Array<number>(size + 1).fill(0);
  const v = new Array<number>(size + 1).fill(0);
  const p = new Array<number>(size + 1).fill(0); // column -> row
  const way = new Array<number>(size + 1).fill(0);

  for (let rowIndex = 1; rowIndex <= size; rowIndex += 1) {
    p[0] = rowIndex;
    let column0 = 0;

    const minv = new Array<number>(size + 1).fill(Number.POSITIVE_INFINITY);
    const used = new Array<boolean>(size + 1).fill(false);

    do {
      used[column0] = true;
      const row0 = p[column0];
      let delta = Number.POSITIVE_INFINITY;
      let column1 = 0;

      for (let columnIndex = 1; columnIndex <= size; columnIndex += 1) {
        if (used[columnIndex]) continue;
        const rawCost = costMatrix[row0 - 1][columnIndex - 1];
        const reducedCost = toFiniteCost(rawCost) - u[row0] - v[columnIndex];
        if (reducedCost < minv[columnIndex]) {
          minv[columnIndex] = reducedCost;
          way[columnIndex] = column0;
        }
        if (minv[columnIndex] < delta) {
          delta = minv[columnIndex];
          column1 = columnIndex;
        }
      }

      // Guard: no path found (should not happen with finite costs).
      if (!Number.isFinite(delta)) {
        throw new Error("Hungarian assignment failed: delta became infinite");
      }

      for (let columnIndex = 0; columnIndex <= size; columnIndex += 1) {
        if (used[columnIndex]) {
          u[p[columnIndex]] += delta;
          v[columnIndex] -= delta;
        } else {
          minv[columnIndex] -= delta;
        }
      }

      column0 = column1;
    } while (p[column0] !== 0);

    do {
      const column1 = way[column0];
      p[column0] = p[column1];
      column0 = column1;
    } while (column0 !== 0);
  }

  const assignment = new Array<number>(size).fill(-1);
  for (let columnIndex = 1; columnIndex <= size; columnIndex += 1) {
    const assignedRow = p[columnIndex];
    if (assignedRow <= 0) continue;
    assignment[assignedRow - 1] = columnIndex - 1;
  }
  return assignment;
}

