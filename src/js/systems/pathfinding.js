import { CONFIG } from '../config.js';

/**
 * Pathfinding - A* pathfinding implementation for enemy AI
 */
export class Pathfinding {
    /**
     * Find a path from start to goal using A* algorithm
     * @param {number} startX - Starting X coordinate
     * @param {number} startY - Starting Y coordinate
     * @param {number} goalX - Goal X coordinate
     * @param {number} goalY - Goal Y coordinate
     * @param {Array} map - 2D array of the map
     * @param {Map} enemyMap - Map of enemy positions to avoid
     * @param {number} maxIterations - Maximum iterations to prevent infinite loops
     * @returns {Array|null} Array of {x, y} points, or null if no path found
     */
    static findPath(startX, startY, goalX, goalY, map, enemyMap, maxIterations = 500) {
        // If start is goal, return empty path
        if (startX === goalX && startY === goalY) {
            return [];
        }

        const openSet = [];
        const closedSet = new Set();
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();

        const startKey = this.toKey(startX, startY);
        const goalKey = this.toKey(goalX, goalY);

        openSet.push({ x: startX, y: startY, key: startKey });
        gScore.set(startKey, 0);
        fScore.set(startKey, this.heuristic(startX, startY, goalX, goalY));

        let iterations = 0;

        while (openSet.length > 0 && iterations < maxIterations) {
            iterations++;

            // Get node with lowest fScore
            openSet.sort((a, b) => (fScore.get(a.key) || Infinity) - (fScore.get(b.key) || Infinity));
            const current = openSet.shift();

            // Reached the goal (or adjacent to it - for attacking)
            if (current.key === goalKey || this.isAdjacent(current.x, current.y, goalX, goalY)) {
                return this.reconstructPath(cameFrom, current);
            }

            closedSet.add(current.key);

            // Check all neighbors
            const neighbors = this.getNeighbors(current.x, current.y, map, enemyMap, goalX, goalY);

            for (const neighbor of neighbors) {
                if (closedSet.has(neighbor.key)) continue;

                const tentativeG = (gScore.get(current.key) || Infinity) + 1;

                const inOpen = openSet.find(n => n.key === neighbor.key);
                if (!inOpen) {
                    openSet.push(neighbor);
                } else if (tentativeG >= (gScore.get(neighbor.key) || Infinity)) {
                    continue;
                }

                cameFrom.set(neighbor.key, current);
                gScore.set(neighbor.key, tentativeG);
                fScore.set(neighbor.key, tentativeG + this.heuristic(neighbor.x, neighbor.y, goalX, goalY));
            }
        }

        // No path found
        return null;
    }

    /**
     * Get the next step toward the player (first step of path)
     * @returns {{dx: number, dy: number}|null} Direction to move, or null if no path
     */
    static getNextStep(startX, startY, goalX, goalY, map, enemyMap) {
        const path = this.findPath(startX, startY, goalX, goalY, map, enemyMap);

        if (!path || path.length === 0) {
            return null;
        }

        // First step in path
        const next = path[0];
        return {
            dx: next.x - startX,
            dy: next.y - startY
        };
    }

    /**
     * Get valid neighboring tiles
     */
    static getNeighbors(x, y, map, enemyMap, goalX, goalY) {
        const directions = [
            { dx: 0, dy: -1 },  // up
            { dx: 0, dy: 1 },   // down
            { dx: -1, dy: 0 },  // left
            { dx: 1, dy: 0 }    // right
        ];

        const neighbors = [];

        for (const dir of directions) {
            const nx = x + dir.dx;
            const ny = y + dir.dy;

            // Check bounds
            if (nx < 0 || nx >= CONFIG.MAP_WIDTH || ny < 0 || ny >= CONFIG.MAP_HEIGHT) {
                continue;
            }

            // Check if walkable (floor or elevator)
            const tile = map[ny][nx];
            if (tile !== CONFIG.TILE.FLOOR && tile !== CONFIG.TILE.ELEVATOR) {
                continue;
            }

            // Allow moving to goal position (player position for attack)
            const isGoal = nx === goalX && ny === goalY;

            // Check for other enemies (but allow goal position)
            const key = this.toKey(nx, ny);
            if (!isGoal && enemyMap && enemyMap.has(ny * CONFIG.MAP_WIDTH + nx)) {
                continue;
            }

            neighbors.push({ x: nx, y: ny, key });
        }

        return neighbors;
    }

    /**
     * Manhattan distance heuristic
     */
    static heuristic(x1, y1, x2, y2) {
        return Math.abs(x1 - x2) + Math.abs(y1 - y2);
    }

    /**
     * Check if two positions are adjacent
     */
    static isAdjacent(x1, y1, x2, y2) {
        const dx = Math.abs(x1 - x2);
        const dy = Math.abs(y1 - y2);
        return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
    }

    /**
     * Convert coordinates to a unique key
     */
    static toKey(x, y) {
        return y * CONFIG.MAP_WIDTH + x;
    }

    /**
     * Reconstruct path from cameFrom map
     */
    static reconstructPath(cameFrom, current) {
        const path = [{ x: current.x, y: current.y }];
        let key = current.key;

        while (cameFrom.has(key)) {
            const node = cameFrom.get(key);
            path.unshift({ x: node.x, y: node.y });
            key = node.key;
        }

        // Remove start position from path
        path.shift();
        return path;
    }
}
