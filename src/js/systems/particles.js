export class ParticleSystem {
    constructor(container) {
        this.container = container;
        this.particles = [];
        this.gravity = 80;         // falling speed adjustment
    }

    update(dt) {
        // dt is delta time in seconds (or fractional seconds)
        // If coming from requestAnimationFrame, convert appropriately.
        // Assuming dt is around 0.016 for 60fps

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt;

            if (p.life <= 0) {
                p.element.remove();
                this.particles.splice(i, 1);
                continue;
            }

            // Physics
            p.vy += this.gravity * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;

            // Simple floor collision (if we want them to bounce at bottom of screen? or just fall off)
            // Let's just let them fall off for now, or maybe bounce if 'y' hits screen height.
            // Screen coords are pixels.

            // Render
            p.element.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.rot}deg)`;
            p.rot += p.rotSpeed * dt;
        }
    }

    spawn(x, y, char, color, type) {
        // x, y are pixel coordinates (screen space)

        const el = document.createElement('div');
        el.className = 'particle';
        el.innerText = char;
        el.style.color = color;
        this.container.appendChild(el);

        // Initial Velocity
        let vx = (Math.random() - 0.5) * 100; // Random horizontal
        let vy = -100 - Math.random() * 100; // Upward toss

        if (type === 'shell') {
            vx = (Math.random() * 50) + 20; // Eject to right mostly
            vy = -150 - Math.random() * 50;
        } else if (type === 'mag') {
            vx = (Math.random() * 20) - 10; // Drop down mostly
            vy = 50;
        }

        this.particles.push({
            x: x,
            y: y,
            vx: vx,
            vy: vy,
            life: 2.0, // seconds
            element: el,
            rot: Math.random() * 360,
            rotSpeed: (Math.random() - 0.5) * 720
        });
    }

    // Helper for shell casing
    spawnShell(x, y) {
        // Convert tile coords to pixel coords if needed, handled by Game
        this.spawn(x, y, '-', '#ccaa00', 'shell'); // Gold/Brass color
    }

    // Helper for mag drop
    spawnMag(x, y) {
        this.spawn(x, y, '[=]', '#444', 'mag');
    }
}
