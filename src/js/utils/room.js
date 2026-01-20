export class Room {
    constructor(x, y, w, h) {
        this.x1 = x;
        this.y1 = y;
        this.x2 = x + w;
        this.y2 = y + h;
    }

    center() {
        return {
            x: Math.floor((this.x1 + this.x2) / 2),
            y: Math.floor((this.y1 + this.y2) / 2)
        };
    }

    intersects(other) {
        return (this.x1 <= other.x2 && this.x2 >= other.x1 &&
            this.y1 <= other.y2 && this.y2 >= other.y1);
    }
}
