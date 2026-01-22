export class Enemy {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.hp = type === 'M' ? 3 : 2; // Melee tougher than Ranged
        this.maxHp = this.hp;
        this.alerted = false;
        this.alive = true;
        this.lastHit = 0;
    }

    takeDamage(amount) {
        this.hp -= amount;
        this.alerted = true;
        this.lastHit = Date.now();
        if (this.hp <= 0) {
            this.alive = false;
            return true;
        }
        return false;
    }
}
