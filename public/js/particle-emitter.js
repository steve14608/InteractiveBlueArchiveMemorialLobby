/*!
 * @pixi/particle-emitter - v6.0.0
 * Compiled Sun, 15 Jun 2025 10:57:30 UTC
 *
 * @pixi/particle-emitter is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 */
this.PIXI = this.PIXI || {};
(function (exports, pixi_js) {
    'use strict';

    var Types = {
        __proto__: null
    };

    /**
     * A spawn shape that picks a random position along a series of line segments. If those
     * line segments form a polygon, particles will only be placed on the perimeter of that polygon.
     *
     * Example config:
     * ```javascript
     * {
     *      type: 'polygonalChain',
     *      data: [
     *          [{x: 0, y: 0}, {x: 10, y: 10}, {x: 20, y: 0}],
     *          [{x: 0, y, -10}, {x: 10, y: 0}, {x: 20, y: -10}]
     *      ]
     * }
     * ```
     */
    class PolygonalChain {
        /**
         * @param data Point data for polygon chains. Either a list of points for a single chain, or a list of chains.
         */
        constructor(data) {
            this.segments = [];
            this.countingLengths = [];
            this.totalLength = 0;
            this.init(data);
        }
        /**
         * @param data Point data for polygon chains. Either a list of points for a single chain, or a list of chains.
         */
        init(data) {
            // if data is not present, set up a segment of length 0
            if (!data || !data.length) {
                this.segments.push({ p1: { x: 0, y: 0 }, p2: { x: 0, y: 0 }, l: 0 });
            }
            else if (Array.isArray(data[0])) {
                // list of segment chains, each defined as a list of points
                for (let i = 0; i < data.length; ++i) {
                    // loop through the chain, connecting points
                    const chain = data[i];
                    let prevPoint = chain[0];
                    for (let j = 1; j < chain.length; ++j) {
                        const second = chain[j];
                        this.segments.push({ p1: prevPoint, p2: second, l: 0 });
                        prevPoint = second;
                    }
                }
            }
            else {
                let prevPoint = data[0];
                // list of points
                for (let i = 1; i < data.length; ++i) {
                    const second = data[i];
                    this.segments.push({ p1: prevPoint, p2: second, l: 0 });
                    prevPoint = second;
                }
            }
            // now go through our segments to calculate the lengths so that we
            // can set up a nice weighted random distribution
            for (let i = 0; i < this.segments.length; ++i) {
                const { p1, p2 } = this.segments[i];
                const segLength = Math.sqrt(((p2.x - p1.x) * (p2.x - p1.x)) + ((p2.y - p1.y) * (p2.y - p1.y)));
                // save length so we can turn a random number into a 0-1 interpolation value later
                this.segments[i].l = segLength;
                this.totalLength += segLength;
                // keep track of the length so far, counting up
                this.countingLengths.push(this.totalLength);
            }
        }
        /**
         * Gets a random point in the chain.
         * @param out - Particle ?, because was point data
         */
        getRandPos(out) {
            // select a random spot in the length of the chain
            const rand = Math.random() * this.totalLength;
            let chosenSeg;
            let lerp;
            // if only one segment, it wins
            if (this.segments.length === 1) {
                chosenSeg = this.segments[0];
                lerp = rand;
            }
            else {
                // otherwise, go through countingLengths until we have determined
                // which segment we chose
                for (let i = 0; i < this.countingLengths.length; ++i) {
                    if (rand < this.countingLengths[i]) {
                        chosenSeg = this.segments[i];
                        // set lerp equal to the length into that segment
                        // (i.e. the remainder after subtracting all the segments before it)
                        lerp = i === 0 ? rand : rand - this.countingLengths[i - 1];
                        break;
                    }
                }
            }
            // divide lerp by the segment length, to result in a 0-1 number.
            lerp /= chosenSeg.l || 1;
            const { p1, p2 } = chosenSeg;
            // now calculate the position in the segment that the lerp value represents
            out.x = p1.x + (lerp * (p2.x - p1.x));
            out.y = p1.y + (lerp * (p2.y - p1.y));
        }
    }
    PolygonalChain.type = 'polygonalChain';
    PolygonalChain.editorConfig = null;

    /**
     * A SpawnShape that randomly picks locations inside a rectangle.
     *
     * Example config:
     * ```javascript
     * {
     *     type: 'rect',
     *     data: {
     *          x: 0,
     *          y: 0,
     *          w: 10,
     *          h: 100
     *     }
     * }
     * ```
     */
    class Rectangle {
        constructor(config) {
            this.x = config.x;
            this.y = config.y;
            this.w = config.w;
            this.h = config.h;
        }
        getRandPos(particle) {
            // place the particle at a random point in the rectangle
            particle.x = (Math.random() * this.w) + this.x;
            particle.y = (Math.random() * this.h) + this.y;
        }
    }
    Rectangle.type = 'rect';
    Rectangle.editorConfig = null;

    /**
     * A single node in a PropertyList.
     */
    class PropertyNode {
        /**
         * @param value The value for this node
         * @param time The time for this node, between 0-1
         * @param [ease] Custom ease for this list. Only relevant for the first node.
         */
        constructor(value, time, ease) {
            this.value = value;
            this.time = time;
            this.next = null;
            this.isStepped = false;
            if (ease) {
                this.ease = typeof ease === 'function' ? ease : generateEase(ease);
            }
            else {
                this.ease = null;
            }
        }
        /**
         * Creates a list of property values from a data object {list, isStepped} with a list of objects in
         * the form {value, time}. Alternatively, the data object can be in the deprecated form of
         * {start, end}.
         * @param data The data for the list.
         * @param data.list The array of value and time objects.
         * @param data.isStepped If the list is stepped rather than interpolated.
         * @param data.ease Custom ease for this list.
         * @return The first node in the list
         */
        // eslint-disable-next-line max-len
        static createList(data) {
            if ('list' in data) {
                const array = data.list;
                let node;
                const { value, time } = array[0];
                // eslint-disable-next-line max-len
                const first = node = new PropertyNode(typeof value === 'string' ? hexToRGB(value) : value, time, data.ease);
                // only set up subsequent nodes if there are a bunch or the 2nd one is different from the first
                if (array.length > 2 || (array.length === 2 && array[1].value !== value)) {
                    for (let i = 1; i < array.length; ++i) {
                        const { value, time } = array[i];
                        node.next = new PropertyNode(typeof value === 'string' ? hexToRGB(value) : value, time);
                        node = node.next;
                    }
                }
                first.isStepped = !!data.isStepped;
                return first;
            }
            // Handle deprecated version here
            const start = new PropertyNode(typeof data.start === 'string' ? hexToRGB(data.start) : data.start, 0);
            // only set up a next value if it is different from the starting value
            if (data.end !== data.start) {
                start.next = new PropertyNode(typeof data.end === 'string' ? hexToRGB(data.end) : data.end, 1);
            }
            return start;
        }
    }

    /**
     * The method used by behaviors to fetch textures. Defaults to Texture.from.
     */
    // get Texture.from(), only supports V5 and V6 with individual packages
    // eslint-disable-next-line prefer-const
    let GetTextureFromString = pixi_js.Texture.from;
    /**
     * If errors and warnings should be logged within the library.
     */
    const verbose = false;
    const DEG_TO_RADS = Math.PI / 180;
    /**
     * Rotates a point by a given angle.
     * @param angle The angle to rotate by in radians
     * @param p The point to rotate around 0,0.
     */
    function rotatePoint(angle, p) {
        if (!angle)
            return;
        const s = Math.sin(angle);
        const c = Math.cos(angle);
        const xnew = (p.x * c) - (p.y * s);
        const ynew = (p.x * s) + (p.y * c);
        p.x = xnew;
        p.y = ynew;
    }
    /**
     * Combines separate color components (0-255) into a single uint color.
     * @param r The red value of the color
     * @param g The green value of the color
     * @param b The blue value of the color
     * @return The color in the form of 0xRRGGBB
     */
    function combineRGBComponents(r, g, b /* , a*/) {
        return /* a << 24 |*/ (r << 16) | (g << 8) | b;
    }
    /**
     * Returns the length (or magnitude) of this point.
     * @param point The point to measure length
     * @return The length of this point.
     */
    function length(point) {
        return Math.sqrt((point.x * point.x) + (point.y * point.y));
    }
    /**
     * Reduces the point to a length of 1.
     * @param point The point to normalize
     */
    function normalize(point) {
        const oneOverLen = 1 / length(point);
        point.x *= oneOverLen;
        point.y *= oneOverLen;
    }
    /**
     * Multiplies the x and y values of this point by a value.
     * @param point The point to scaleBy
     * @param value The value to scale by.
     */
    function scaleBy(point, value) {
        point.x *= value;
        point.y *= value;
    }
    /**
     * Converts a hex string from "#AARRGGBB", "#RRGGBB", "0xAARRGGBB", "0xRRGGBB",
     * "AARRGGBB", or "RRGGBB" to an object of ints of 0-255, as
     * {r, g, b, (a)}.
     * @param color The input color string.
     * @param output An object to put the output in. If omitted, a new object is created.
     * @return The object with r, g, and b properties, possibly with an a property.
     */
    function hexToRGB(color, output) {
        if (!output) {
            output = {};
        }
        if (color.charAt(0) === '#') {
            color = color.substr(1);
        }
        else if (color.indexOf('0x') === 0) {
            color = color.substr(2);
        }
        let alpha;
        if (color.length === 8) {
            alpha = color.substr(0, 2);
            color = color.substr(2);
        }
        output.r = parseInt(color.substr(0, 2), 16); // Red
        output.g = parseInt(color.substr(2, 2), 16); // Green
        output.b = parseInt(color.substr(4, 2), 16); // Blue
        if (alpha) {
            output.a = parseInt(alpha, 16);
        }
        return output;
    }
    /**
     * Generates a custom ease function, based on the GreenSock custom ease, as demonstrated
     * by the related tool at http://www.greensock.com/customease/.
     * @param segments An array of segments, as created by
     * http://www.greensock.com/customease/.
     * @return A function that calculates the percentage of change at
     *                    a given point in time (0-1 inclusive).
     */
    function generateEase(segments) {
        const qty = segments.length;
        const oneOverQty = 1 / qty;
        /*
            * Calculates the percentage of change at a given point in time (0-1 inclusive).
            * @param {Number} time The time of the ease, 0-1 inclusive.
            * @return {Number} The percentage of the change, 0-1 inclusive (unless your
            *                  ease goes outside those bounds).
            */
        // eslint-disable-next-line func-names
        return function (time) {
            const i = (qty * time) | 0; // do a quick floor operation
            const t = (time - (i * oneOverQty)) * qty;
            const s = segments[i] || segments[qty - 1];
            return (s.s + (t * ((2 * (1 - t) * (s.cp - s.s)) + (t * (s.e - s.s)))));
        };
    }
    /**
     * Gets a blend mode, ensuring that it is valid.
     * @param name The name of the blend mode to get.
     * @return The blend mode as specified in the PIXI.BLEND_MODES enumeration.
     */
    function getBlendMode(name) {
        return name || 'normal';
    }
    /**
     * Converts a list of {value, time} objects starting at time 0 and ending at time 1 into an evenly
     * spaced stepped list of PropertyNodes for color values. This is primarily to handle conversion of
     * linear gradients to fewer colors, allowing for some optimization for Canvas2d fallbacks.
     * @param list The list of data to convert.
     * @param [numSteps=10] The number of steps to use.
     * @return The blend mode as specified in the PIXI.blendModes enumeration.
     */
    function createSteppedGradient(list, numSteps = 10) {
        if (typeof numSteps !== 'number' || numSteps <= 0) {
            numSteps = 10;
        }
        const first = new PropertyNode(hexToRGB(list[0].value), list[0].time);
        first.isStepped = true;
        let currentNode = first;
        let current = list[0];
        let nextIndex = 1;
        let next = list[nextIndex];
        for (let i = 1; i < numSteps; ++i) {
            let lerp = i / numSteps;
            // ensure we are on the right segment, if multiple
            while (lerp > next.time) {
                current = next;
                next = list[++nextIndex];
            }
            // convert the lerp value to the segment range
            lerp = (lerp - current.time) / (next.time - current.time);
            const curVal = hexToRGB(current.value);
            const nextVal = hexToRGB(next.value);
            const output = {
                r: ((nextVal.r - curVal.r) * lerp) + curVal.r,
                g: ((nextVal.g - curVal.g) * lerp) + curVal.g,
                b: ((nextVal.b - curVal.b) * lerp) + curVal.b,
            };
            currentNode.next = new PropertyNode(output, i / numSteps);
            currentNode = currentNode.next;
        }
        // we don't need to have a PropertyNode for time of 1, because in a stepped version at that point
        // the particle has died of old age
        return first;
    }

    var ParticleUtils$1 = {
        __proto__: null,
        DEG_TO_RADS: DEG_TO_RADS,
        GetTextureFromString: GetTextureFromString,
        combineRGBComponents: combineRGBComponents,
        createSteppedGradient: createSteppedGradient,
        generateEase: generateEase,
        getBlendMode: getBlendMode,
        hexToRGB: hexToRGB,
        length: length,
        normalize: normalize,
        rotatePoint: rotatePoint,
        scaleBy: scaleBy,
        verbose: verbose
    };

    /**
     * A class for spawning particles in a circle or ring.
     * Can optionally apply rotation to particles so that they are aimed away from the center of the circle.
     *
     * Example config:
     * ```javascript
     * {
     *     type: 'torus',
     *     data: {
     *          radius: 30,
     *          x: 0,
     *          y: 0,
     *          innerRadius: 10,
     *          rotation: true
     *     }
     * }
     * ```
     */
    class Torus {
        constructor(config) {
            this.x = config.x || 0;
            this.y = config.y || 0;
            this.radius = config.radius;
            this.innerRadius = config.innerRadius || 0;
            this.rotation = !!config.affectRotation;
        }
        getRandPos(particle) {
            // place the particle at a random radius in the ring
            if (this.innerRadius !== this.radius) {
                particle.x = (Math.random() * (this.radius - this.innerRadius)) + this.innerRadius;
            }
            else {
                particle.x = this.radius;
            }
            particle.y = 0;
            // rotate the point to a random angle in the circle
            const angle = Math.random() * Math.PI * 2;
            if (this.rotation) {
                particle.rotation += angle;
            }
            rotatePoint(angle, particle.position);
            // now add in the center of the torus
            particle.position.x += this.x;
            particle.position.y += this.y;
        }
    }
    Torus.type = 'torus';
    Torus.editorConfig = null;

    var index = {
        __proto__: null,
        PolygonalChain: PolygonalChain,
        Rectangle: Rectangle,
        Torus: Torus
    };

    /**
     * Standard behavior order values, specifying when/how they are used. Other numeric values can be used,
     * but only the Spawn value will be handled in a special way. All other values will be sorted numerically.
     * Behaviors with the same value will not be given any specific sort order, as they are assumed to not
     * interfere with each other.
     */
    var BehaviorOrder;
    (function (BehaviorOrder) {
        BehaviorOrder[BehaviorOrder["Lifetime"] = 0] = "Lifetime";
        /**
         * Spawn - initial placement and/or rotation. This happens before rotation/translation due to
         * emitter rotation/position is applied.
         */
        BehaviorOrder[BehaviorOrder["Spawn"] = 1] = "Spawn";
        /**
         * Normal priority, for things that don't matter when they are applied.
         */
        BehaviorOrder[BehaviorOrder["Normal"] = 3] = "Normal";
        /**
         * Delayed priority, for things that need to read other values in order to act correctly.
         */
        BehaviorOrder[BehaviorOrder["Late"] = 6] = "Late";
    })(BehaviorOrder || (BehaviorOrder = {}));

    /**
     * A Movement behavior that handles movement by applying a constant acceleration to all particles.
     *
     * Example configuration:
     * ```javascript
     * {
     *     "type": "moveAcceleration",
     *     "config": {
     *          "accel": {
     *               "x": 0,
     *               "y": 2000
     *          },
     *          "minStart": 600,
     *          "maxStart": 600,
     *          "rotate": true
     *     }
     *}
     * ```
     */
    class AccelerationBehavior {
        constructor(config) {
            // doesn't _really_ need to be late, but doing so ensures that we can override any
            // rotation behavior that is mistakenly added
            this.order = BehaviorOrder.Late;
            this.minStart = config.minStart;
            this.maxStart = config.maxStart;
            this.accel = config.accel;
            this.rotate = !!config.rotate;
            this.maxSpeed = config.maxSpeed ?? 0;
        }
        initParticles(first) {
            let next = first;
            while (next) {
                const speed = (Math.random() * (this.maxStart - this.minStart)) + this.minStart;
                if (!next.config.velocity) {
                    next.config.velocity = new pixi_js.Point(speed, 0);
                }
                else {
                    next.config.velocity.set(speed, 0);
                }
                rotatePoint(next.rotation, next.config.velocity);
                next = next.next;
            }
        }
        updateParticle(particle, deltaSec) {
            const vel = particle.config.velocity;
            const oldVX = vel.x;
            const oldVY = vel.y;
            vel.x += this.accel.x * deltaSec;
            vel.y += this.accel.y * deltaSec;
            if (this.maxSpeed) {
                const currentSpeed = length(vel);
                // if we are going faster than we should, clamp at the max speed
                // DO NOT recalculate vector length
                if (currentSpeed > this.maxSpeed) {
                    scaleBy(vel, this.maxSpeed / currentSpeed);
                }
            }
            // calculate position delta by the midpoint between our old velocity and our new velocity
            particle.x += (oldVX + vel.x) / 2 * deltaSec;
            particle.y += (oldVY + vel.y) / 2 * deltaSec;
            if (this.rotate) {
                particle.rotation = Math.atan2(vel.y, vel.x);
            }
        }
    }
    AccelerationBehavior.type = 'moveAcceleration';
    AccelerationBehavior.editorConfig = null;

    function intValueSimple(lerp) {
        if (this.ease)
            lerp = this.ease(lerp);
        return ((this.first.next.value - this.first.value) * lerp) + this.first.value;
    }
    function intColorSimple(lerp) {
        if (this.ease)
            lerp = this.ease(lerp);
        const curVal = this.first.value;
        const nextVal = this.first.next.value;
        const r = ((nextVal.r - curVal.r) * lerp) + curVal.r;
        const g = ((nextVal.g - curVal.g) * lerp) + curVal.g;
        const b = ((nextVal.b - curVal.b) * lerp) + curVal.b;
        return combineRGBComponents(r, g, b);
    }
    function intValueComplex(lerp) {
        if (this.ease)
            lerp = this.ease(lerp);
        // make sure we are on the right segment
        let current = this.first;
        let next = current.next;
        while (lerp > next.time) {
            current = next;
            next = next.next;
        }
        // convert the lerp value to the segment range
        lerp = (lerp - current.time) / (next.time - current.time);
        return ((next.value - current.value) * lerp) + current.value;
    }
    function intColorComplex(lerp) {
        if (this.ease)
            lerp = this.ease(lerp);
        // make sure we are on the right segment
        let current = this.first;
        let next = current.next;
        while (lerp > next.time) {
            current = next;
            next = next.next;
        }
        // convert the lerp value to the segment range
        lerp = (lerp - current.time) / (next.time - current.time);
        const curVal = current.value;
        const nextVal = next.value;
        const r = ((nextVal.r - curVal.r) * lerp) + curVal.r;
        const g = ((nextVal.g - curVal.g) * lerp) + curVal.g;
        const b = ((nextVal.b - curVal.b) * lerp) + curVal.b;
        return combineRGBComponents(r, g, b);
    }
    function intValueStepped(lerp) {
        if (this.ease)
            lerp = this.ease(lerp);
        // make sure we are on the right segment
        let current = this.first;
        while (current.next && lerp > current.next.time) {
            current = current.next;
        }
        return current.value;
    }
    function intColorStepped(lerp) {
        if (this.ease)
            lerp = this.ease(lerp);
        // make sure we are on the right segment
        let current = this.first;
        while (current.next && lerp > current.next.time) {
            current = current.next;
        }
        const curVal = current.value;
        return combineRGBComponents(curVal.r, curVal.g, curVal.b);
    }
    /**
     * Singly linked list container for keeping track of interpolated properties for particles.
     * Each Particle will have one of these for each interpolated property.
     */
    class PropertyList {
        /**
         * @param isColor If this list handles color values
         */
        constructor(isColor = false) {
            this.first = null;
            this.isColor = !!isColor;
            this.interpolate = null;
            this.ease = null;
        }
        /**
         * Resets the list for use.
         * @param first The first node in the list.
         * @param first.isStepped If the values should be stepped instead of interpolated linearly.
         */
        reset(first) {
            this.first = first;
            const isSimple = first.next && first.next.time >= 1;
            if (isSimple) {
                this.interpolate = this.isColor ? intColorSimple : intValueSimple;
            }
            else if (first.isStepped) {
                this.interpolate = this.isColor ? intColorStepped : intValueStepped;
            }
            else {
                this.interpolate = this.isColor ? intColorComplex : intValueComplex;
            }
            this.ease = this.first.ease;
        }
    }

    /**
     * An Alpha behavior that applies an interpolated or stepped list of values to the particle's opacity.
     *
     * Example config:
     * ```javascript
     * {
     *     type: 'alpha',
     *     config: {
     *         alpha: {
     *              list: [{value: 0, time: 0}, {value: 1, time: 0.25}, {value: 0, time: 1}]
     *         },
     *     }
     * }
     * ```
     */
    class AlphaBehavior {
        constructor(config) {
            this.order = BehaviorOrder.Normal;
            this.list = new PropertyList(false);
            this.list.reset(PropertyNode.createList(config.alpha));
        }
        initParticles(first) {
            let next = first;
            while (next) {
                next.alpha = this.list.first.value;
                next = next.next;
            }
        }
        updateParticle(particle) {
            particle.alpha = this.list.interpolate(particle.agePercent);
        }
    }
    AlphaBehavior.type = 'alpha';
    AlphaBehavior.editorConfig = null;
    /**
     * An Alpha behavior that applies a static value to the particle's opacity at particle initialization.
     *
     * Example config:
     * ```javascript
     * {
     *     type: 'alphaStatic',
     *     config: {
     *         alpha: 0.75,
     *     }
     * }
     * ```
     */
    class StaticAlphaBehavior {
        constructor(config) {
            this.order = BehaviorOrder.Normal;
            this.value = config.alpha;
        }
        initParticles(first) {
            let next = first;
            while (next) {
                next.alpha = this.value;
                next = next.next;
            }
        }
    }
    StaticAlphaBehavior.type = 'alphaStatic';
    StaticAlphaBehavior.editorConfig = null;

    function getTextures(textures) {
        const outTextures = [];
        for (let j = 0; j < textures.length; ++j) {
            let tex = textures[j];
            if (typeof tex === 'string') {
                outTextures.push(GetTextureFromString(tex));
            }
            else if (tex instanceof pixi_js.Texture) {
                outTextures.push(tex);
            }
            // assume an object with extra data determining duplicate frame data
            else {
                let dupe = tex.count || 1;
                if (typeof tex.texture === 'string') {
                    tex = GetTextureFromString(tex.texture);
                }
                else // if(tex.texture instanceof Texture)
                 {
                    tex = tex.texture;
                }
                for (; dupe > 0; --dupe) {
                    outTextures.push(tex);
                }
            }
        }
        return outTextures;
    }
    /**
     * A Texture behavior that picks a random animation for each particle to play.
     * See {@link AnimatedParticleArt} for detailed configuration info.
     *
     * Example config:
     * ```javascript
     * {
     *     type: 'animatedRandom',
     *     config: {
     *         anims: [
     *              {
     *                  framerate: 25,
     *                  loop: true,
     *                  textures: ['frame1', 'frame2', 'frame3']
     *              },
     *              {
     *                  framerate: 25,
     *                  loop: true,
     *                  textures: ['frame3', 'frame2', 'frame1']
     *              }
     *         ],
     *     }
     * }
     * ```
     */
    class RandomAnimatedTextureBehavior {
        constructor(config) {
            this.order = BehaviorOrder.Normal;
            this.anims = [];
            for (let i = 0; i < config.anims.length; ++i) {
                const anim = config.anims[i];
                const textures = getTextures(anim.textures);
                // eslint-disable-next-line no-nested-ternary
                const framerate = anim.framerate < 0 ? -1 : (anim.framerate > 0 ? anim.framerate : 60);
                const parsedAnim = {
                    textures,
                    duration: framerate > 0 ? textures.length / framerate : 0,
                    framerate,
                    loop: framerate > 0 ? !!anim.loop : false,
                };
                this.anims.push(parsedAnim);
            }
        }
        initParticles(first) {
            let next = first;
            while (next) {
                const index = Math.floor(Math.random() * this.anims.length);
                const anim = next.config.anim = this.anims[index];
                next.texture = anim.textures[0];
                next.config.animElapsed = 0;
                // if anim should match particle life exactly
                if (anim.framerate === -1) {
                    next.config.animDuration = next.maxLife;
                    next.config.animFramerate = anim.textures.length / next.maxLife;
                }
                else {
                    next.config.animDuration = anim.duration;
                    next.config.animFramerate = anim.framerate;
                }
                next = next.next;
            }
        }
        updateParticle(particle, deltaSec) {
            const config = particle.config;
            const anim = config.anim;
            config.animElapsed += deltaSec;
            if (config.animElapsed >= config.animDuration) {
                // loop elapsed back around
                if (config.anim.loop) {
                    config.animElapsed = config.animElapsed % config.animDuration;
                }
                // subtract a small amount to prevent attempting to go past the end of the animation
                else {
                    config.animElapsed = config.animDuration - 0.000001;
                }
            }
            // add a very small number to the frame and then floor it to avoid
            // the frame being one short due to floating point errors.
            const frame = ((config.animElapsed * config.animFramerate) + 0.0000001) | 0;
            // in the very rare case that framerate * elapsed math ends up going past the end, use the last texture
            particle.texture = anim.textures[frame] || anim.textures[anim.textures.length - 1] || pixi_js.Texture.EMPTY;
        }
    }
    RandomAnimatedTextureBehavior.type = 'animatedRandom';
    RandomAnimatedTextureBehavior.editorConfig = null;
    /**
     * A Texture behavior that uses a single animation for each particle to play.
     * See {@link AnimatedParticleArt} for detailed configuration info.
     *
     * Example config:
     * ```javascript
     * {
     *     type: 'animatedSingle',
     *     config: {
     *         anim: {
     *              framerate: 25,
     *              loop: true,
     *              textures: ['frame1', 'frame2', 'frame3']
     *         }
     *     }
     * }
     * ```
     */
    class SingleAnimatedTextureBehavior {
        constructor(config) {
            this.order = BehaviorOrder.Normal;
            const anim = config.anim;
            const textures = getTextures(anim.textures);
            // eslint-disable-next-line no-nested-ternary
            const framerate = anim.framerate < 0 ? -1 : (anim.framerate > 0 ? anim.framerate : 60);
            this.anim = {
                textures,
                duration: framerate > 0 ? textures.length / framerate : 0,
                framerate,
                loop: framerate > 0 ? !!anim.loop : false,
            };
        }
        initParticles(first) {
            let next = first;
            const anim = this.anim;
            while (next) {
                next.texture = anim.textures[0];
                next.config.animElapsed = 0;
                // if anim should match particle life exactly
                if (anim.framerate === -1) {
                    next.config.animDuration = next.maxLife;
                    next.config.animFramerate = anim.textures.length / next.maxLife;
                }
                else {
                    next.config.animDuration = anim.duration;
                    next.config.animFramerate = anim.framerate;
                }
                next = next.next;
            }
        }
        updateParticle(particle, deltaSec) {
            const anim = this.anim;
            const config = particle.config;
            config.animElapsed += deltaSec;
            if (config.animElapsed >= config.animDuration) {
                // loop elapsed back around
                if (anim.loop) {
                    config.animElapsed = config.animElapsed % config.animDuration;
                }
                // subtract a small amount to prevent attempting to go past the end of the animation
                else {
                    config.animElapsed = config.animDuration - 0.000001;
                }
            }
            // add a very small number to the frame and then floor it to avoid
            // the frame being one short due to floating point errors.
            const frame = ((config.animElapsed * config.animFramerate) + 0.0000001) | 0;
            // in the very rare case that framerate * elapsed math ends up going past the end, use the last texture
            particle.texture = anim.textures[frame] || anim.textures[anim.textures.length - 1] || pixi_js.Texture.EMPTY;
        }
    }
    SingleAnimatedTextureBehavior.type = 'animatedSingle';
    SingleAnimatedTextureBehavior.editorConfig = null;

    /**
     * A Blend Mode behavior that applies a blend mode value to the particle at initialization.
     *
     * Example config:
     * ```javascript
     * {
     *     type: 'blendMode',
     *     config: {
     *         blendMode: 'multiply',
     *     }
     * }
     * ```
     */
    class BlendModeBehavior {
        constructor(config) {
            this.order = BehaviorOrder.Normal;
            this.value = config.blendMode;
        }
        initParticles(first) {
            let next = first;
            while (next) {
                next.blendMode = getBlendMode(this.value);
                next = next.next;
            }
        }
    }
    BlendModeBehavior.type = 'blendMode';
    BlendModeBehavior.editorConfig = null;

    /**
     * A Spawn behavior that sends particles out from a single point or ring, and is capable of evenly spacing
     * the particle's starting angles.
     *
     * Example config:
     * ```javascript
     * {
     *     type: 'spawnBurst',
     *     config: {
     *          spacing: 90,
     *          start: 0,
     *          distance: 40,
     *     }
     * }
     * ```
     */
    class BurstSpawnBehavior {
        constructor(config) {
            this.order = BehaviorOrder.Spawn;
            this.spacing = config.spacing * DEG_TO_RADS;
            this.start = config.start * DEG_TO_RADS;
            this.distance = config.distance;
        }
        initParticles(first) {
            let count = 0;
            let next = first;
            while (next) {
                let angle;
                if (this.spacing) {
                    angle = this.start + (this.spacing * count);
                }
                else {
                    angle = Math.random() * Math.PI * 2;
                }
                next.rotation = angle;
                if (this.distance) {
                    next.position.x = this.distance;
                    rotatePoint(angle, next.position);
                }
                next = next.next;
                ++count;
            }
        }
    }
    BurstSpawnBehavior.type = 'spawnBurst';
    BurstSpawnBehavior.editorConfig = null;

    /**
     * A Color behavior that applies an interpolated or stepped list of values to the particle's tint property.
     *
     * Example config:
     * ```javascript
     * {
     *     type: 'color',
     *     config: {
     *         color: {
     *              list: [{value: '#ff0000' time: 0}, {value: '#00ff00', time: 0.5}, {value: '#0000ff', time: 1}]
     *         },
     *     }
     * }
     * ```
     */
    class ColorBehavior {
        constructor(config) {
            this.order = BehaviorOrder.Normal;
            this.list = new PropertyList(true);
            this.list.reset(PropertyNode.createList(config.color));
        }
        initParticles(first) {
            let next = first;
            const color = this.list.first.value;
            const tint = combineRGBComponents(color.r, color.g, color.b);
            while (next) {
                next.tint = tint;
                next = next.next;
            }
        }
        updateParticle(particle) {
            particle.tint = this.list.interpolate(particle.agePercent);
        }
    }
    ColorBehavior.type = 'color';
    ColorBehavior.editorConfig = null;
    /**
     * A Color behavior that applies a single color to the particle's tint property at initialization.
     *
     * Example config:
     * ```javascript
     * {
     *     type: 'colorStatic',
     *     config: {
     *         color: '#ffff00',
     *     }
     * }
     * ```
     */
    class StaticColorBehavior {
        constructor(config) {
            this.order = BehaviorOrder.Normal;
            let color = config.color;
            if (color.charAt(0) === '#') {
                color = color.substr(1);
            }
            else if (color.indexOf('0x') === 0) {
                color = color.substr(2);
            }
            this.value = parseInt(color, 16);
        }
        initParticles(first) {
            let next = first;
            while (next) {
                next.tint = this.value;
                next = next.next;
            }
        }
    }
    StaticColorBehavior.type = 'colorStatic';
    StaticColorBehavior.editorConfig = null;

    /**
     * A Texture behavior that assigns a texture to each particle from its list, in order, before looping around to the first
     * texture again. String values will be converted to textures with {@link ParticleUtils.GetTextureFromString}.
     *
     * Example config:
     * ```javascript
     * {
     *     type: 'textureOrdered',
     *     config: {
     *         textures: ["myTex1Id", "myTex2Id", "myTex3Id", "myTex4Id"],
     *     }
     * }
     * ```
     */
    class OrderedTextureBehavior {
        constructor(config) {
            this.order = BehaviorOrder.Normal;
            this.index = 0;
            this.textures = config.textures.map((tex) => (typeof tex === 'string' ? GetTextureFromString(tex) : tex));
        }
        initParticles(first) {
            let next = first;
            while (next) {
                next.texture = this.textures[this.index];
                if (++this.index >= this.textures.length) {
                    this.index = 0;
                }
                next = next.next;
            }
        }
    }
    OrderedTextureBehavior.type = 'textureOrdered';
    OrderedTextureBehavior.editorConfig = null;

    /**
     * A helper point for math things.
     * @hidden
     */
    const helperPoint = new pixi_js.Point();
    /**
     * A hand picked list of Math functions (and a couple properties) that are
     * allowable. They should be used without the preceding "Math."
     * @hidden
     */
    const MATH_FUNCS = [
        'E',
        'LN2',
        'LN10',
        'LOG2E',
        'LOG10E',
        'PI',
        'SQRT1_2',
        'SQRT2',
        'abs',
        'acos',
        'acosh',
        'asin',
        'asinh',
        'atan',
        'atanh',
        'atan2',
        'cbrt',
        'ceil',
        'cos',
        'cosh',
        'exp',
        'expm1',
        'floor',
        'fround',
        'hypot',
        'log',
        'log1p',
        'log10',
        'log2',
        'max',
        'min',
        'pow',
        'random',
        'round',
        'sign',
        'sin',
        'sinh',
        'sqrt',
        'tan',
        'tanh',
    ];
    /**
     * create an actual regular expression object from the string
     * @hidden
     */
    const WHITELISTER = new RegExp([
        // Allow the 4 basic operations, parentheses and all numbers/decimals, as well
        // as 'x', for the variable usage.
        '[01234567890\\.\\*\\-\\+\\/\\(\\)x ,]',
    ].concat(MATH_FUNCS).join('|'), 'g');
    /**
     * Parses a string into a function for path following.
     * This involves whitelisting the string for safety, inserting "Math." to math function
     * names, and using `new Function()` to generate a function.
     * @hidden
     * @param pathString The string to parse.
     * @return The path function - takes x, outputs y.
     */
    function parsePath(pathString) {
        const matches = pathString.match(WHITELISTER);
        for (let i = matches.length - 1; i >= 0; --i) {
            if (MATH_FUNCS.indexOf(matches[i]) >= 0) {
                matches[i] = `Math.${matches[i]}`;
            }
        }
        pathString = matches.join('');
        // eslint-disable-next-line no-new-func
        return new Function('x', `return ${pathString};`);
    }
    /**
     * A particle that follows a path defined by an algebraic expression, e.g. "sin(x)" or
     * "5x + 3".
     * To use this class, the behavior config must have a "path" string or function.
     *
     * A string should have "x" in it to represent movement (from the
     * speed settings of the behavior). It may have numbers, parentheses, the four basic
     * operations, and any Math functions or properties (without the preceding "Math.").
     * The overall movement of the particle and the expression value become x and y positions for
     * the particle, respectively. The final position is rotated by the spawn rotation/angle of
     * the particle.
     *
     * A function merely needs to accept the "x" argument and output the a corresponding "y" value.
     *
     * Some example paths:
     *
     * * `"sin(x/10) * 20"` A sine wave path.
     * * `"cos(x/100) * 30"` Particles curve counterclockwise (for medium speed/low lifetime particles)
     * * `"pow(x/10, 2) / 2"` Particles curve clockwise (remember, +y is down).
     * * `(x) => Math.floor(x) * 3` Supplying an existing function should look like this
     *
     * Example configuration:
     * ```javascript
     * {
     *     "type": "movePath",
     *     "config": {
     *          "path": "round(sin(x) * 2",
     *          "speed": {
     *              "list": [{value: 10, time: 0}, {value: 100, time: 0.25}, {value: 0, time: 1}],
     *          },
     *          "minMult": 0.8
     *     }
     *}
     */
    class PathBehavior {
        constructor(config) {
            // *MUST* happen after other behaviors do initialization so that we can read initial transformations
            this.order = BehaviorOrder.Late;
            if (config.path) {
                if (typeof config.path === 'function') {
                    this.path = config.path;
                }
                else {
                    try {
                        this.path = parsePath(config.path);
                    }
                    catch (e) {
                        if (verbose) {
                            console.error('PathParticle: error in parsing path expression', e);
                        }
                        this.path = null;
                    }
                }
            }
            else {
                if (verbose) {
                    console.error('PathParticle requires a path value in its config!');
                }
                // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
                this.path = (x) => x;
            }
            this.list = new PropertyList(false);
            this.list.reset(PropertyNode.createList(config.speed));
            this.minMult = config.minMult ?? 1;
        }
        initParticles(first) {
            let next = first;
            while (next) {
                /*
                 * The initial rotation in degrees of the particle, because the direction of the path
                 * is based on that.
                 */
                next.config.initRotation = next.rotation;
                /* The initial position of the particle, as all path movement is added to that. */
                if (!next.config.initPosition) {
                    next.config.initPosition = new pixi_js.Point(next.x, next.y);
                }
                else {
                    next.config.initPosition.copyFrom(next.position);
                }
                /* Total single directional movement, due to speed. */
                next.config.movement = 0;
                // also do speed multiplier, since this includes basic speed movement
                const mult = (Math.random() * (1 - this.minMult)) + this.minMult;
                next.config.speedMult = mult;
                next = next.next;
            }
        }
        updateParticle(particle, deltaSec) {
            // increase linear movement based on speed
            const speed = this.list.interpolate(particle.agePercent) * particle.config.speedMult;
            particle.config.movement += speed * deltaSec;
            // set up the helper point for rotation
            helperPoint.x = particle.config.movement;
            helperPoint.y = this.path(helperPoint.x);
            rotatePoint(particle.config.initRotation, helperPoint);
            particle.position.x = particle.config.initPosition.x + helperPoint.x;
            particle.position.y = particle.config.initPosition.y + helperPoint.y;
        }
    }
    PathBehavior.type = 'movePath';
    PathBehavior.editorConfig = null;

    /**
     * A Spawn behavior that sends particles out from a single point at the emitter's position.
     *
     * Example config:
     * ```javascript
     * {
     *     type: 'spawnPoint',
     *     config: {}
     * }
     * ```
     */
    class PointSpawnBehavior {
        constructor() {
            this.order = BehaviorOrder.Spawn;
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        initParticles(_first) {
            // really just a no-op
        }
    }
    PointSpawnBehavior.type = 'spawnPoint';
    PointSpawnBehavior.editorConfig = null;

    /**
     * A Texture behavior that assigns a random texture to each particle from its list.
     * String values will be converted to textures with {@link ParticleUtils.GetTextureFromString}.
     *
     * Example config:
     * ```javascript
     * {
     *     type: 'textureRandom',
     *     config: {
     *         textures: ["myTex1Id", "myTex2Id", "myTex3Id", "myTex4Id"],
     *     }
     * }
     * ```
     */
    class RandomTextureBehavior {
        constructor(config) {
            this.order = BehaviorOrder.Normal;
            this.textures = config.textures.map((tex) => (typeof tex === 'string' ? GetTextureFromString(tex) : tex));
        }
        initParticles(first) {
            let next = first;
            while (next) {
                const index = Math.floor(Math.random() * this.textures.length);
                next.texture = this.textures[index];
                next = next.next;
            }
        }
    }
    RandomTextureBehavior.type = 'textureRandom';
    RandomTextureBehavior.editorConfig = null;

    /**
     * A Rotation behavior that handles starting rotation, rotation speed, and rotational acceleration.
     *
     * Example configuration:
     * ```javascript
     * {
     *     "type": "rotation",
     *     "config": {
     *          "minStart": 0,
     *          "maxStart": 180,
     *          "minSpeed": 30,
     *          "maxSpeed": 45,
     *          "accel": 20
     *     }
     *}
     * ```
     */
    class RotationBehavior {
        constructor(config) {
            this.order = BehaviorOrder.Normal;
            this.minStart = config.minStart * DEG_TO_RADS;
            this.maxStart = config.maxStart * DEG_TO_RADS;
            this.minSpeed = config.minSpeed * DEG_TO_RADS;
            this.maxSpeed = config.maxSpeed * DEG_TO_RADS;
            this.accel = config.accel * DEG_TO_RADS;
        }
        initParticles(first) {
            let next = first;
            while (next) {
                if (this.minStart === this.maxStart) {
                    next.rotation += this.maxStart;
                }
                else {
                    next.rotation += (Math.random() * (this.maxStart - this.minStart)) + this.minStart;
                }
                next.config.rotSpeed = (Math.random() * (this.maxSpeed - this.minSpeed)) + this.minSpeed;
                next = next.next;
            }
        }
        updateParticle(particle, deltaSec) {
            if (this.accel) {
                const oldSpeed = particle.config.rotSpeed;
                particle.config.rotSpeed += this.accel * deltaSec;
                particle.rotation += (particle.config.rotSpeed + oldSpeed) / 2 * deltaSec;
            }
            else {
                particle.rotation += particle.config.rotSpeed * deltaSec;
            }
        }
    }
    RotationBehavior.type = 'rotation';
    RotationBehavior.editorConfig = null;
    /**
     * A Rotation behavior that handles starting rotation.
     *
     * Example configuration:
     * ```javascript
     * {
     *     "type": "rotationStatic",
     *     "config": {
     *          "min": 0,
     *          "max": 180,
     *     }
     *}
     * ```
     */
    class StaticRotationBehavior {
        constructor(config) {
            this.order = BehaviorOrder.Normal;
            this.min = config.min * DEG_TO_RADS;
            this.max = config.max * DEG_TO_RADS;
        }
        initParticles(first) {
            let next = first;
            while (next) {
                if (this.min === this.max) {
                    next.rotation += this.max;
                }
                else {
                    next.rotation += (Math.random() * (this.max - this.min)) + this.min;
                }
                next = next.next;
            }
        }
    }
    StaticRotationBehavior.type = 'rotationStatic';
    StaticRotationBehavior.editorConfig = null;
    /**
     * A Rotation behavior that blocks all rotation caused by spawn settings,
     * by resetting it to the specified rotation (or 0).
     *
     * Example configuration:
     * ```javascript
     * {
     *     "type": "noRotation",
     *     "config": {
     *          "rotation": 0
     *     }
     *}
     * ```
     */
    class NoRotationBehavior {
        constructor(config) {
            this.order = BehaviorOrder.Late + 1;
            this.rotation = (config.rotation || 0) * DEG_TO_RADS;
        }
        initParticles(first) {
            let next = first;
            while (next) {
                next.rotation = this.rotation;
                next = next.next;
            }
        }
    }
    NoRotationBehavior.type = 'noRotation';
    NoRotationBehavior.editorConfig = null;

    /**
     * A Scale behavior that applies an interpolated or stepped list of values to the particle's x & y scale.
     *
     * Example config:
     * ```javascript
     * {
     *     type: 'scale',
     *     config: {
     *          scale: {
     *              list: [{value: 0, time: 0}, {value: 1, time: 0.25}, {value: 0, time: 1}],
     *              isStepped: true
     *          },
     *          minMult: 0.5
     *     }
     * }
     * ```
     */
    class ScaleBehavior {
        constructor(config) {
            this.order = BehaviorOrder.Normal;
            this.list = new PropertyList(false);
            this.list.reset(PropertyNode.createList(config.scale));
            this.minMult = config.minMult ?? 1;
        }
        initParticles(first) {
            let next = first;
            while (next) {
                const mult = (Math.random() * (1 - this.minMult)) + this.minMult;
                next.config.scaleMult = mult;
                next.scale.x = next.scale.y = this.list.first.value * mult;
                next = next.next;
            }
        }
        updateParticle(particle) {
            particle.scale.x = particle.scale.y = this.list.interpolate(particle.agePercent) * particle.config.scaleMult;
        }
    }
    ScaleBehavior.type = 'scale';
    ScaleBehavior.editorConfig = null;
    /**
     * A Scale behavior that applies a randomly picked value to the particle's x & y scale at initialization.
     *
     * Example config:
     * ```javascript
     * {
     *     type: 'scaleStatic',
     *     config: {
     *         min: 0.25,
     *         max: 0.75,
     *     }
     * }
     * ```
     */
    class StaticScaleBehavior {
        constructor(config) {
            this.order = BehaviorOrder.Normal;
            this.min = config.min;
            this.max = config.max;
        }
        initParticles(first) {
            let next = first;
            while (next) {
                const scale = (Math.random() * (this.max - this.min)) + this.min;
                next.scale.x = next.scale.y = scale;
                next = next.next;
            }
        }
    }
    StaticScaleBehavior.type = 'scaleStatic';
    StaticScaleBehavior.editorConfig = null;

    /**
     * A Spawn behavior that places (and optionally rotates) particles according to a
     * specified shape. Additional shapes can be registered with {@link registerShape | SpawnShape.registerShape()}.
     * Additional shapes must implement the {@link SpawnShape} interface, and their class must match the
     * {@link SpawnShapeClass} interface.
     * Shapes included by default are:
     * * {@link Rectangle}
     * * {@link Torus}
     * * {@link PolygonalChain}
     *
     * Example config:
     * ```javascript
     * {
     *     type: 'spawnShape',
     *     config: {
     *          type: 'rect',
     *          data: {
     *              x: 0,
     *              y: 0,
     *              width: 20,
     *              height: 300,
     *          }
     *     }
     * }
     * ```
     */
    class ShapeSpawnBehavior {
        /**
         * Registers a shape to be used by the ShapeSpawn behavior.
         * @param constructor The shape class constructor to use, with a static `type` property to reference it by.
         * @param typeOverride An optional type override, primarily for registering a shape under multiple names.
         */
        static registerShape(constructor, typeOverride) {
            ShapeSpawnBehavior.shapes[typeOverride || constructor.type] = constructor;
        }
        constructor(config) {
            this.order = BehaviorOrder.Spawn;
            const ShapeClass = ShapeSpawnBehavior.shapes[config.type];
            if (!ShapeClass) {
                throw new Error(`No shape found with type '${config.type}'`);
            }
            this.shape = new ShapeClass(config.data);
        }
        initParticles(first) {
            let next = first;
            while (next) {
                this.shape.getRandPos(next);
                next = next.next;
            }
        }
    }
    ShapeSpawnBehavior.type = 'spawnShape';
    ShapeSpawnBehavior.editorConfig = null;
    /**
     * Dictionary of all registered shape classes.
     */
    ShapeSpawnBehavior.shapes = {};
    ShapeSpawnBehavior.registerShape(PolygonalChain);
    ShapeSpawnBehavior.registerShape(Rectangle);
    ShapeSpawnBehavior.registerShape(Torus);
    ShapeSpawnBehavior.registerShape(Torus, 'circle');

    /**
     * A Textuure behavior that assigns a single texture to each particle.
     * String values will be converted to textures with {@link ParticleUtils.GetTextureFromString}.
     *
     * Example config:
     * ```javascript
     * {
     *     type: 'textureSingle',
     *     config: {
     *         texture: Texture.from('myTexId'),
     *     }
     * }
     * ```
     */
    class SingleTextureBehavior {
        constructor(config) {
            this.order = BehaviorOrder.Normal;
            this.texture = typeof config.texture === 'string' ? GetTextureFromString(config.texture) : config.texture;
        }
        initParticles(first) {
            let next = first;
            while (next) {
                next.texture = this.texture;
                next = next.next;
            }
        }
    }
    SingleTextureBehavior.type = 'textureSingle';
    SingleTextureBehavior.editorConfig = null;

    /**
     * A Movement behavior that uses an interpolated or stepped list of values for a particles speed at any given moment.
     * Movement direction is controlled by the particle's starting rotation.
     *
     * Example config:
     * ```javascript
     * {
     *     type: 'moveSpeed',
     *     config: {
     *          speed: {
     *              list: [{value: 10, time: 0}, {value: 100, time: 0.25}, {value: 0, time: 1}],
     *          },
     *          minMult: 0.8
     *     }
     * }
     * ```
     */
    class SpeedBehavior {
        constructor(config) {
            this.order = BehaviorOrder.Late;
            this.list = new PropertyList(false);
            this.list.reset(PropertyNode.createList(config.speed));
            this.minMult = config.minMult ?? 1;
        }
        initParticles(first) {
            let next = first;
            while (next) {
                const mult = (Math.random() * (1 - this.minMult)) + this.minMult;
                next.config.speedMult = mult;
                if (!next.config.velocity) {
                    next.config.velocity = new pixi_js.Point(this.list.first.value * mult, 0);
                }
                else {
                    next.config.velocity.set(this.list.first.value * mult, 0);
                }
                rotatePoint(next.rotation, next.config.velocity);
                next = next.next;
            }
        }
        updateParticle(particle, deltaSec) {
            const speed = this.list.interpolate(particle.agePercent) * particle.config.speedMult;
            const vel = particle.config.velocity;
            normalize(vel);
            scaleBy(vel, speed);
            particle.x += vel.x * deltaSec;
            particle.y += vel.y * deltaSec;
        }
    }
    SpeedBehavior.type = 'moveSpeed';
    SpeedBehavior.editorConfig = null;
    /**
     * A Movement behavior that uses a randomly picked constant speed throughout a particle's lifetime.
     * Movement direction is controlled by the particle's starting rotation.
     *
     * Example config:
     * ```javascript
     * {
     *     type: 'moveSpeedStatic',
     *     config: {
     *          min: 100,
     *          max: 150
     *     }
     * }
     * ```
     */
    class StaticSpeedBehavior {
        constructor(config) {
            this.order = BehaviorOrder.Late;
            this.min = config.min;
            this.max = config.max;
        }
        initParticles(first) {
            let next = first;
            while (next) {
                const speed = (Math.random() * (this.max - this.min)) + this.min;
                if (!next.config.velocity) {
                    next.config.velocity = new pixi_js.Point(speed, 0);
                }
                else {
                    next.config.velocity.set(speed, 0);
                }
                rotatePoint(next.rotation, next.config.velocity);
                next = next.next;
            }
        }
        updateParticle(particle, deltaSec) {
            const velocity = particle.config.velocity;
            particle.x += velocity.x * deltaSec;
            particle.y += velocity.y * deltaSec;
        }
    }
    StaticSpeedBehavior.type = 'moveSpeedStatic';
    StaticSpeedBehavior.editorConfig = null;

    /**
     * A Color behavior that applies an interpolated or stepped list of values to the particle's tint property.
     *
     * Example config:
     * ```javascript
     * {
     *     type: 'color',
     *     config: {
     *         color: {
     *              list: [{value: '#ff0000' time: 0}, {value: '#00ff00', time: 0.5}, {value: '#0000ff', time: 1}]
     *         },
     *     }
     * }
     * ```
     */
    class LifetimeBehavior {
        constructor(config) {
            this.order = BehaviorOrder.Lifetime;
            this.list = new PropertyList(false);
            this.list.reset(PropertyNode.createList(config.lifetime));
        }
        initParticles(first) {
            let next = first;
            let count = 0;
            while (next) {
                ++count;
                next = next.next;
            }
            next = first;
            const delta = 1 / count;
            let proportion = 0;
            while (next) {
                next.init(this.list.interpolate(proportion));
                proportion += delta;
                next = next.next;
            }
        }
    }
    LifetimeBehavior.type = 'lifetime';
    LifetimeBehavior.editorConfig = null;
    /**
     * A Color behavior that applies a single color to the particle's tint property at initialization.
     *
     * Example config:
     * ```javascript
     * {
     *     type: 'colorStatic',
     *     config: {
     *         color: '#ffff00',
     *     }
     * }
     * ```
     */
    class StaticLifetimeBehavior {
        constructor(config) {
            this.order = BehaviorOrder.Lifetime;
            this.minlifetime = config.minlifetime;
            this.maxlifetime = config.maxlifetime;
        }
        initParticles(first) {
            let next = first;
            while (next) {
                let lifetime;
                if (this.minlifetime === this.maxlifetime) {
                    lifetime = this.minlifetime;
                }
                else {
                    lifetime = (Math.random() * (this.maxlifetime - this.minlifetime)) + this.minlifetime;
                }
                next.init(lifetime);
                next = next.next;
            }
        }
    }
    StaticLifetimeBehavior.type = 'lifetimeStatic';
    StaticLifetimeBehavior.editorConfig = null;

    // export support types for external use

    /**
     * An individual particle image. You shouldn't have to deal with these.
     */
    class Particle extends pixi_js.Sprite {
        /**
         * @param emitter The emitter that controls this particle.
         */
        constructor(emitter) {
            // start off the sprite with a blank texture, since we are going to replace it
            // later when the particle is initialized.
            super();
            // initialize LinkedListChild props so they are included in underlying JS class definition
            this.prevChild = this.nextChild = null;
            this.emitter = emitter;
            this.config = {};
            // particles should be centered
            this.anchor.x = this.anchor.y = 0.5;
            this.maxLife = 0;
            this.age = 0;
            this.agePercent = 0;
            this.oneOverLife = 0;
            this.next = null;
            this.prev = null;
            // save often used functions on the instance instead of the prototype for better speed
            this.init = this.init;
            this.kill = this.kill;
        }
        /**
         * Initializes the particle for use, based on the properties that have to
         * have been set already on the particle.
         */
        init(maxLife) {
            this.maxLife = maxLife;
            // reset the age
            this.age = this.agePercent = 0;
            // reset the sprite props
            this.rotation = 0;
            this.position.x = this.position.y = 0;
            this.scale.x = this.scale.y = 1;
            this.tint = 0xffffff;
            this.alpha = 1;
            // save our lerp helper
            this.oneOverLife = 1 / this.maxLife;
            // ensure visibility
            this.visible = true;
        }
        /**
         * Kills the particle, removing it from the display list
         * and telling the emitter to recycle it.
         */
        kill() {
            this.emitter.recycle(this);
        }
        /**
         * Destroys the particle, removing references and preventing future use.
         */
        destroy() {
            if (this.parent) {
                this.parent.removeChild(this);
            }
            this.emitter = this.next = this.prev = null;
            super.destroy();
        }
    }

    // get the shared ticker, only supports V5 and V6 with individual packages
    /**
     * @hidden
     */
    const ticker = pixi_js.Ticker.shared;
    /**
     * Key used in sorted order to determine when to set particle position from the emitter position
     * and rotation.
     */
    const PositionParticle = Symbol('Position particle per emitter position');
    /**
     * A particle emitter.
     */
    class Emitter {
        /**
         * Registers a new behavior, so that it will be recognized when initializing emitters.
         * Behaviors registered later with duplicate types will override older ones, although there is no limit on
         * the allowed types.
         * @param constructor The behavior class to register.
         */
        static registerBehavior(constructor) {
            Emitter.knownBehaviors[constructor.type] = constructor;
        }
        /**
         * @param particleParent The container to add the particles to.
         * @param particleImages A texture or array of textures to use
         *                       for the particles. Strings will be turned
         *                       into textures via Texture.from().
         * @param config A configuration object containing settings for the emitter.
         * @param config.emit If config.emit is explicitly passed as false, the
         *                    Emitter will start disabled.
         * @param config.autoUpdate If config.autoUpdate is explicitly passed as
         *                          true, the Emitter will automatically call
         *                          update via the PIXI shared ticker.
         */
        constructor(particleParent, config) {
            this._waiting = null;
            this.initBehaviors = [];
            this.updateBehaviors = [];
            this.recycleBehaviors = [];
            // properties for individual particles
            // this.minLifetime = 0;
            // this.maxLifetime = 0;
            this.customEase = null;
            // properties for spawning particles
            this._frequency = 1;
            this.spawnChance = 1;
            this.maxParticles = 1000;
            this.emitterLifetime = -1;
            this.spawnPos = new pixi_js.Point();
            this.particlesPerWave = 1;
            // emitter properties
            this.rotation = 0;
            this.ownerPos = new pixi_js.Point();
            this._prevEmitterPos = new pixi_js.Point();
            this._prevPosIsValid = false;
            this._posChanged = false;
            this._parent = null;
            this.addAtBack = false;
            this.particleCount = 0;
            this._emit = false;
            this._spawnTimer = 0;
            this._emitterLife = -1;
            this._activeParticlesFirst = null;
            this._activeParticlesLast = null;
            this._poolFirst = null;
            this._origConfig = null;
            this._autoUpdate = false;
            this._destroyWhenComplete = false;
            this._completeCallback = null;
            this._attachedEmitters = [];
            this._attachedEmitterConfigs = [];
            this._distance = 0;
            this._interval = 2;
            this._emitsTaskList = [];
            this._emitsTaskTimer = [];
            // set the initial parent
            this.parent = particleParent;
            if (config) {
                this.init(config);
            }
            // save often used functions on the instance instead of the prototype for better speed
            this.recycle = this.recycle;
            this.update = this.update;
            this.rotate = this.rotate;
            this.updateSpawnPos = this.updateSpawnPos;
            this.updateOwnerPos = this.updateOwnerPos;
        }
        /**
         * Time between particle spawns in seconds. If this value is not a number greater than 0,
         * it will be set to 1 (particle per second) to prevent infinite loops.
         */
        get frequency() { return this._frequency; }
        set frequency(value) {
            // do some error checking to prevent infinite loops
            if (typeof value === 'number' && value > 0) {
                this._frequency = value;
            }
            else {
                this._frequency = 1;
            }
        }
        /**
        * The container to add particles to. Settings this will dump any active particles.
        */
        get parent() { return this._parent; }
        set parent(value) {
            this.cleanup();
            this._parent = value;
        }
        /**
         * Sets up the emitter based on the config settings.
         * @param config A configuration object containing settings for the emitter.
         */
        init(config) {
            if (!config) {
                return;
            }
            // clean up any existing particles
            this.cleanup();
            // store the original config and particle images, in case we need to re-initialize
            // when the particle constructor is changed
            this._origConfig = config;
            // /////////////////////////
            // Particle Properties    //
            // /////////////////////////
            // set up the lifetime
            // this.minLifetime = config.lifetime.min;
            // this.maxLifetime = config.lifetime.max;
            // use the custom ease if provided
            if (config.ease) {
                this.customEase = typeof config.ease === 'function'
                    ? config.ease : generateEase(config.ease);
            }
            else {
                this.customEase = null;
            }
            // ////////////////////////
            // Emitter Properties    //
            // ////////////////////////
            // reset spawn type specific settings
            this.particlesPerWave = 1;
            if (config.particlesPerWave && config.particlesPerWave > 1) {
                this.particlesPerWave = config.particlesPerWave;
            }
            // set the spawning frequency
            this.frequency = config.frequency;
            this.spawnChance = (typeof config.spawnChance === 'number' && config.spawnChance > 0) ? config.spawnChance : 1;
            // set the emitter lifetime
            this.emitterLifetime = config.emitterLifetime || -1;
            // set the max particles
            this.maxParticles = config.maxParticles > 0 ? config.maxParticles : 1000;
            // determine if we should add the particle at the back of the list or not
            this.addAtBack = !!config.addAtBack;
            // reset the emitter position and rotation variables
            this.rotation = 0;
            this.ownerPos.set(0);
            if (config.pos) {
                this.spawnPos.copyFrom(config.pos);
            }
            else {
                this.spawnPos.set(0);
            }
            this._prevEmitterPos.copyFrom(this.spawnPos);
            // previous emitter position is invalid and should not be used for interpolation
            this._prevPosIsValid = false;
            // start emitting
            this._spawnTimer = 0;
            this.emit = config.emit === undefined ? true : !!config.emit;
            this.autoUpdate = !!config.autoUpdate;
            // ////////////////////////
            // Behaviors             //
            // ////////////////////////
            const behaviors = config.behaviors.map((data) => {
                const constructor = Emitter.knownBehaviors[data.type];
                if (!constructor) {
                    console.error(`Unknown behavior: ${data.type}`);
                    return null;
                }
                return new constructor(data.config);
            })
                .filter((b) => !!b);
            behaviors.push(PositionParticle);
            behaviors.sort((a, b) => {
                if (a.order === BehaviorOrder.Lifetime)
                    return -1;
                if (b.order === BehaviorOrder.Lifetime)
                    return 1;
                if (a === PositionParticle) {
                    return b.order === BehaviorOrder.Spawn ? 1 : -1;
                }
                else if (b === PositionParticle) {
                    return a.order === BehaviorOrder.Spawn ? -1 : 1;
                }
                return a.order - b.order;
            });
            this.initBehaviors = behaviors.slice();
            this.updateBehaviors = behaviors.filter((b) => b !== PositionParticle && b.updateParticle);
            this.recycleBehaviors = behaviors.filter((b) => b !== PositionParticle && b.recycleParticle);
            if (config.interval && config.interval > 0) {
                this._interval = config.interval;
            }
        }
        /**
         * Gets the instantiated behavior of the specified type, if it is present on this emitter.
         * @param type The behavior type to find.
         */
        getBehavior(type) {
            // bail if we don't know about such an emitter
            if (!Emitter.knownBehaviors[type])
                return null;
            // find one that is an instance of the specified type
            return this.initBehaviors.find((b) => b instanceof Emitter.knownBehaviors[type]) || null;
        }
        /**
         * Fills the pool with the specified number of particles, so that they don't have to be instantiated later.
         * @param count The number of particles to create.
         */
        fillPool(count) {
            for (; count > 0; --count) {
                const p = new Particle(this);
                p.next = this._poolFirst;
                this._poolFirst = p;
            }
        }
        /**
         * Recycles an individual particle. For internal use only.
         * @param particle The particle to recycle.
         * @param fromCleanup If this is being called to manually clean up all particles.
         * @internal
         */
        recycle(particle, fromCleanup = false) {
            for (let i = 0; i < this.recycleBehaviors.length; ++i) {
                this.recycleBehaviors[i].recycleParticle(particle, !fromCleanup);
            }
            if (particle.next) {
                particle.next.prev = particle.prev;
            }
            if (particle.prev) {
                particle.prev.next = particle.next;
            }
            if (particle === this._activeParticlesLast) {
                this._activeParticlesLast = particle.prev;
            }
            if (particle === this._activeParticlesFirst) {
                this._activeParticlesFirst = particle.next;
            }
            // add to pool
            particle.prev = null;
            particle.next = this._poolFirst;
            this._poolFirst = particle;
            // remove child from display, or make it invisible if it is in a ParticleContainer
            if (particle.parent) {
                particle.parent.removeChild(particle);
            }
            // decrease count
            --this.particleCount;
        }
        /**
         * Sets the rotation of the emitter to a new value. This rotates the spawn position in addition
         * to particle direction.
         * @param newRot The new rotation, in degrees.
         */
        rotate(newRot) {
            if (this.rotation === newRot)
                return;
            // caclulate the difference in rotation for rotating spawnPos
            const diff = newRot - this.rotation;
            this.rotation = newRot;
            // rotate spawnPos
            rotatePoint(diff, this.spawnPos);
            // mark the position as having changed
            this._posChanged = true;
        }
        /**
         * Changes the spawn position of the emitter.
         * @param x The new x value of the spawn position for the emitter.
         * @param y The new y value of the spawn position for the emitter.
         */
        updateSpawnPos(x, y) {
            this._posChanged = true;
            this.spawnPos.x = x;
            this.spawnPos.y = y;
        }
        /**
         * Changes the position of the emitter's owner. You should call this if you are adding
         * particles to the world container that your emitter's owner is moving around in.
         * @param x The new x value of the emitter's owner.
         * @param y The new y value of the emitter's owner.
         */
        updateOwnerPos(x, y) {
            this._posChanged = true;
            this.ownerPos.x = x;
            this.ownerPos.y = y;
        }
        /**
         * Prevents emitter position interpolation in the next update.
         * This should be used if you made a major position change of your emitter's owner
         * that was not normal movement.
         */
        resetPositionTracking() {
            this._prevPosIsValid = false;
        }
        /**
         * If particles should be emitted during update() calls. Setting this to false
         * stops new particles from being created, but allows existing ones to die out.
         */
        get emit() { return this._emit; }
        set emit(value) {
            this._emit = !!value;
            this._emitterLife = this.emitterLifetime;
        }
        /**
         * If the update function is called automatically from the shared ticker.
         * Setting this to false requires calling the update function manually.
         */
        get autoUpdate() { return this._autoUpdate; }
        set autoUpdate(value) {
            if (this._autoUpdate && !value) {
                ticker.remove(this.update, this);
            }
            else if (!this._autoUpdate && value) {
                ticker.add(this.update, this);
            }
            this._autoUpdate = !!value;
        }
        /**
         * Starts emitting particles, sets autoUpdate to true, and sets up the Emitter to destroy itself
         * when particle emission is complete.
         * @param callback Callback for when emission is complete (all particles have died off)
         */
        playOnceAndDestroy(callback) {
            this.autoUpdate = true;
            this.emit = true;
            this._destroyWhenComplete = true;
            this._completeCallback = callback;
        }
        /**
         * Starts emitting particles and optionally calls a callback when particle emission is complete.
         * @param callback Callback for when emission is complete (all particles have died off)
         */
        playOnce(callback) {
            this.emit = true;
            this._completeCallback = callback;
        }
        /**
         * Updates all particles spawned by this emitter and emits new ones.
         * @param delta Time elapsed since the previous frame, in __seconds__. Or Ticker instance for pixi.js v8.0.0
         */
        update(delta) {
            if (typeof delta !== 'number') {
                delta = delta.deltaTime;
            }
            if (this._autoUpdate) {
                delta = ticker.elapsedMS * 0.001;
            }
            // if we don't have a parent to add particles to, then don't do anything.
            // this also works as a isDestroyed check
            if (!this._parent)
                return;
            // == update existing particles ==
            // update all particle lifetimes before turning them over to behaviors
            for (let particle = this._activeParticlesFirst, next; particle; particle = next) {
                // save next particle in case we recycle this one
                next = particle.next;
                // increase age
                particle.age += delta;
                // recycle particle if it is too old
                if (particle.age > particle.maxLife || particle.age < 0) {
                    this.recycle(particle);
                }
                else {
                    // determine our interpolation value
                    let lerp = particle.age * particle.oneOverLife; // lifetime / maxLife;
                    // global ease affects all interpolation calculations
                    if (this.customEase) {
                        if (this.customEase.length === 4) {
                            // the t, b, c, d parameters that some tween libraries use
                            // (time, initial value, end value, duration)
                            lerp = this.customEase(lerp, 0, 1, 1);
                        }
                        else {
                            // the simplified version that we like that takes
                            // one parameter, time from 0-1. TweenJS eases provide this usage.
                            lerp = this.customEase(lerp);
                        }
                    }
                    // set age percent for all interpolation calculations
                    particle.agePercent = lerp;
                    // let each behavior run wild on the active particles
                    for (let i = 0; i < this.updateBehaviors.length; ++i) {
                        if (this.updateBehaviors[i].updateParticle(particle, delta)) {
                            this.recycle(particle);
                            break;
                        }
                    }
                }
            }
            let prevX;
            let prevY;
            // if the previous position is valid, store these for later interpolation
            if (this._prevPosIsValid) {
                prevX = this._prevEmitterPos.x;
                prevY = this._prevEmitterPos.y;
            }
            // store current position of the emitter as local variables
            const curX = this.ownerPos.x + this.spawnPos.x;
            const curY = this.ownerPos.y + this.spawnPos.y;
            // spawn new particles
            if (this._emit) {
                // decrease spawn timer
                this._spawnTimer -= delta < 0 ? 0 : delta;
                // while _spawnTimer < 0, we have particles to spawn
                while (this._spawnTimer <= 0) {
                    // determine if the emitter should stop spawning
                    if (this._emitterLife >= 0) {
                        this._emitterLife -= this._frequency;
                        if (this._emitterLife <= 0) {
                            this._spawnTimer = 0;
                            this._emitterLife = 0;
                            this.emit = false;
                            break;
                        }
                    }
                    // determine if we have hit the particle limit
                    if (this.particleCount >= this.maxParticles) {
                        this._spawnTimer += this._frequency;
                        continue;
                    }
                    let emitPosX;
                    let emitPosY;
                    // If the position has changed and this isn't the first spawn,
                    // interpolate the spawn position
                    if (this._prevPosIsValid && this._posChanged) {
                        // 1 - _spawnTimer / delta, but _spawnTimer is negative
                        const lerp = 1 + (this._spawnTimer / delta);
                        emitPosX = ((curX - prevX) * lerp) + prevX;
                        emitPosY = ((curY - prevY) * lerp) + prevY;
                    }
                    // otherwise just set to the spawn position
                    else {
                        emitPosX = curX;
                        emitPosY = curY;
                    }
                    let waveFirst = null;
                    let waveLast = null;
                    // create enough particles to fill the wave
                    for (let len = Math.min(this.particlesPerWave, this.maxParticles - this.particleCount), i = 0; i < len; ++i) {
                        // see if we actually spawn one
                        if (this.spawnChance < 1 && Math.random() >= this.spawnChance) {
                            continue;
                        }
                        // determine the particle lifetime
                        // let lifetime;
                        // if (this.minLifetime === this.maxLifetime) {
                        //     lifetime = this.minLifetime;
                        // }
                        // else {
                        //     lifetime = (Math.random() * (this.maxLifetime - this.minLifetime)) + this.minLifetime;
                        // }
                        // // only make the particle if it wouldn't immediately destroy itself
                        // if (-this._spawnTimer >= lifetime) {
                        //     continue;
                        // }
                        // create particle
                        let p;
                        if (this._poolFirst) {
                            p = this._poolFirst;
                            this._poolFirst = this._poolFirst.next;
                            p.next = null;
                        }
                        else {
                            p = new Particle(this);
                        }
                        // initialize particle
                        //p.init(lifetime);
                        // add the particle to the display list
                        if (this.addAtBack) {
                            this._parent.addChildAt(p, 0);
                        }
                        else {
                            this._parent.addChild(p);
                        }
                        // add particles to list of ones in this wave
                        if (waveFirst) {
                            waveLast.next = p;
                            p.prev = waveLast;
                            waveLast = p;
                        }
                        else {
                            waveLast = waveFirst = p;
                        }
                        // increase our particle count
                        ++this.particleCount;
                    }
                    if (waveFirst) {
                        // add particle to list of active particles
                        if (this._activeParticlesLast) {
                            this._activeParticlesLast.next = waveFirst;
                            waveFirst.prev = this._activeParticlesLast;
                            this._activeParticlesLast = waveLast;
                        }
                        else {
                            this._activeParticlesFirst = waveFirst;
                            this._activeParticlesLast = waveLast;
                        }
                        // run behavior init on particles
                        for (let i = 0; i < this.initBehaviors.length; ++i) {
                            const behavior = this.initBehaviors[i];
                            // if we hit our special key, interrupt behaviors to apply
                            // emitter position/rotation
                            if (behavior === PositionParticle) {
                                for (let particle = waveFirst, next; particle; particle = next) {
                                    // save next particle in case we recycle this one
                                    next = particle.next;
                                    // rotate the particle's position by the emitter's rotation
                                    if (this.rotation !== 0) {
                                        rotatePoint(this.rotation, particle.position);
                                        particle.rotation += this.rotation;
                                    }
                                    // offset by the emitter's position
                                    particle.position.x += emitPosX;
                                    particle.position.y += emitPosY;
                                    // also, just update the particle's age properties while we are looping through
                                    particle.age += -this._spawnTimer;
                                    // determine our interpolation value
                                    let lerp = particle.age * particle.oneOverLife; // lifetime / maxLife;
                                    // global ease affects all interpolation calculations
                                    if (this.customEase) {
                                        if (this.customEase.length === 4) {
                                            // the t, b, c, d parameters that some tween libraries use
                                            // (time, initial value, end value, duration)
                                            lerp = this.customEase(lerp, 0, 1, 1);
                                        }
                                        else {
                                            // the simplified version that we like that takes
                                            // one parameter, time from 0-1. TweenJS eases provide this usage.
                                            lerp = this.customEase(lerp);
                                        }
                                    }
                                    // set age percent for all interpolation calculations
                                    particle.agePercent = lerp;
                                }
                            }
                            else {
                                behavior.initParticles(waveFirst);
                            }
                        }
                        for (let particle = waveFirst, next; particle; particle = next) {
                            // save next particle in case we recycle this one
                            next = particle.next;
                            // now update the particles by the time passed, so the particles are spread out properly
                            for (let i = 0; i < this.updateBehaviors.length; ++i) {
                                // we want a positive delta, because a negative delta messes things up
                                if (this.updateBehaviors[i].updateParticle(particle, -this._spawnTimer)) {
                                    // bail if the particle got reycled
                                    this.recycle(particle);
                                    break;
                                }
                            }
                        }
                    }
                    // increase timer and continue on to any other particles that need to be created
                    this._spawnTimer += this._frequency;
                }
            }
            //更新emitsTask
            this._emitTask(delta);
            // if the position changed before this update, then keep track of that
            if (this._posChanged) {
                this._prevEmitterPos.x = curX;
                this._prevEmitterPos.y = curY;
                this._prevPosIsValid = true;
                this._posChanged = false;
            }
            // if we are all done and should destroy ourselves, take care of that
            if (!this._emit && !this._activeParticlesFirst) {
                if (this._completeCallback) {
                    const cb = this._completeCallback;
                    this._completeCallback = null;
                    cb();
                }
                if (this._destroyWhenComplete) {
                    this.destroy();
                }
            }
        }
        /**
         * Emits a single wave of particles, using standard spawnChance & particlesPerWave settings. Does not affect
         * regular spawning through the frequency, and ignores the emit property. 自动清除最老的粒子，如果超出了最大上限的话
         */
        emitNow() {
            const emitPosX = this.ownerPos.x + this.spawnPos.x;
            const emitPosY = this.ownerPos.y + this.spawnPos.y;
            let waveFirst = null;
            let waveLast = null;
            for (let len = this.particlesPerWave, i = 0; i < len; ++i) {
                // see if we actually spawn one
                if (this.spawnChance < 1 && Math.random() >= this.spawnChance) {
                    continue;
                }
                // create particle
                let p;
                if (this._poolFirst) {
                    p = this._poolFirst;
                    this._poolFirst = this._poolFirst.next;
                    p.next = null;
                }
                else {
                    p = new Particle(this);
                }
                // let lifetime: number;
                // if (this.minLifetime === this.maxLifetime) {
                //     lifetime = this.minLifetime;
                // }
                // else {
                //     lifetime = (Math.random() * (this.maxLifetime - this.minLifetime)) + this.minLifetime;
                // }
                // initialize particle
                //p.init(lifetime);
                // add the particle to the display list
                if (this.addAtBack) {
                    this._parent.addChildAt(p, 0);
                }
                else {
                    this._parent.addChild(p);
                }
                // add particles to list of ones in this wave
                if (waveFirst) {
                    waveLast.next = p;
                    p.prev = waveLast;
                    waveLast = p;
                }
                else {
                    waveLast = waveFirst = p;
                }
                // increase our particle count
                ++this.particleCount;
            }
            if (waveFirst) {
                // add particle to list of active particles
                if (this._activeParticlesLast) {
                    this._activeParticlesLast.next = waveFirst;
                    waveFirst.prev = this._activeParticlesLast;
                    this._activeParticlesLast = waveLast;
                }
                else {
                    this._activeParticlesFirst = waveFirst;
                    this._activeParticlesLast = waveLast;
                }
                // run behavior init on particles
                for (let i = 0; i < this.initBehaviors.length; ++i) {
                    const behavior = this.initBehaviors[i];
                    // if we hit our special key, interrupt behaviors to apply
                    // emitter position/rotation
                    if (behavior === PositionParticle) {
                        for (let particle = waveFirst, next; particle; particle = next) {
                            // save next particle in case we recycle this one
                            next = particle.next;
                            // rotate the particle's position by the emitter's rotation
                            if (this.rotation !== 0) {
                                rotatePoint(this.rotation, particle.position);
                                particle.rotation += this.rotation;
                            }
                            // offset by the emitter's position
                            particle.position.x += emitPosX;
                            particle.position.y += emitPosY;
                        }
                    }
                    else {
                        behavior.initParticles(waveFirst);
                    }
                }
            }
            //从尾部回收超出部分的粒子
            if (this.particleCount > this.maxParticles) {
                let count = this.particleCount - this.maxParticles;
                let particle;
                let prev;
                for (particle = this._activeParticlesLast; count > 0; particle = prev, count--) {
                    prev = particle.prev;
                    this.recycle(particle);
                }
                this._activeParticlesLast = particle;
            }
        }
        /**
         * 回收多个粒子
         * @param particle 首个被回收的粒子
         * @param count 回收的数量
         * @internal
         */
        recycles(particles, count) {
            if (count <= 0 || count > this.particleCount)
                return;
            let endOfParticles;
            for (let particle = particles, i = 0; i < count; particle = particle.next, ++i) {
                for (let j = 0; j < this.recycleBehaviors.length; ++j) {
                    this.recycleBehaviors[j].recycleParticle(particle, false);
                }
                // // 粒子的age似乎在回收之后会进行一次正负反转，所以age判断小于0或大于最大值才回收，因此需设置为最大值，以免出现后面的粒子生命异常的情况.
                // // 但你直接设置为0不好吗?
                // particle.age = particle.maxLife;
                endOfParticles = particle;
            }
            if (particles.prev) {
                particles.prev.next = endOfParticles.next;
            }
            if (endOfParticles.next) {
                endOfParticles.next.prev = particles.prev;
            }
            if (particles === this._activeParticlesFirst) {
                this._activeParticlesFirst = endOfParticles.next;
            }
            if (endOfParticles === this._activeParticlesLast) {
                this._activeParticlesLast = particles.prev;
            }
            particles.prev = null;
            endOfParticles.next = this._poolFirst;
            this._poolFirst = particles;
            for (let particle = particles; particle != endOfParticles.next; particle = particle.next) {
                if (particle.parent) {
                    particle.parent.removeChild(particle);
                }
            }
            this.particleCount -= count;
        }
        /**
         *
         * 注意，允许粒子超出最大粒子数，仅限于当前被新添加的粒子
         */
        updateTrail(delta) {
            if (typeof delta !== 'number') {
                delta = delta.deltaTime;
            }
            if (this._autoUpdate) {
                delta = ticker.elapsedMS * 0.001;
            }
            // if we don't have a parent to add particles to, then don't do anything.
            // this also works as a isDestroyed check
            if (!this._parent)
                return;
            let prevX;
            let prevY;
            // if the previous position is valid, store these for later interpolation
            if (this._prevPosIsValid) {
                prevX = this._prevEmitterPos.x;
                prevY = this._prevEmitterPos.y;
            }
            else {
                prevX = this.ownerPos.x;
                prevY = this.ownerPos.y;
            }
            // store current position of the emitter as local variables
            const curX = this.ownerPos.x;
            const curY = this.ownerPos.y;
            let waveFirst = null;
            let waveLast = null;
            let addedCount = 0;
            this._distance += Math.hypot(curX - prevX, curY - prevY);
            const count = Math.floor(Math.max(this._distance, 0) / this._interval);
            // this._distance -= (count + 1) * this._interval;
            if (this._emit && count > 0) {
                // decrease spawn timer.说实话只用updateTrail的话这个spawnTimer没什么用
                //this._spawnTimer -= delta < 0 ? 0 : delta;
                let emitPosX = prevX + this.spawnPos.x;
                let emitPosY = prevY + this.spawnPos.y;
                let emitTimeAdvance = delta;
                let deltaX = 0;
                let deltaY = 0;
                let deltaTime = 0;
                deltaX = (curX - prevX) / count;
                deltaY = (curY - prevY) / count;
                deltaTime = -delta / count;
                this._distance -= count * this._interval;
                //那些生成的粒子。我不知道怎么取名，随便取了
                const luckyDogs = new Array(count + 1);
                for (let i = count; i > 0; i--, emitPosX += deltaX, emitPosY += deltaY, emitTimeAdvance += deltaTime) {
                    //see if we actually spawn one
                    if (this.spawnChance < 1 && Math.random() >= this.spawnChance) {
                        continue;
                    }
                    // determine the particle lifetime
                    // let lifetime;
                    // if (this.minLifetime === this.maxLifetime) {
                    //     lifetime = this.minLifetime;
                    // }
                    // else {
                    //     lifetime = (Math.random() * (this.maxLifetime - this.minLifetime)) + this.minLifetime;
                    // }
                    // // only make the particle if it wouldn't immediately destroy itself
                    // if (emitTimeAdvance >= lifetime) {
                    //     continue;
                    // }
                    //存入数组
                    luckyDogs[addedCount++] = {
                        x: emitPosX,
                        y: emitPosY,
                        time: emitTimeAdvance,
                    };
                    // create particle
                    let p;
                    if (this._poolFirst) {
                        p = this._poolFirst;
                        this._poolFirst = this._poolFirst.next;
                        p.next = null;
                    }
                    else {
                        p = new Particle(this);
                    }
                    // initialize particle
                    //p.init(lifetime);
                    // add the particle to the display list
                    if (this.addAtBack) {
                        this._parent.addChildAt(p, 0);
                    }
                    else {
                        this._parent.addChild(p);
                    }
                    // add particles to list of ones in this wave
                    if (waveFirst) {
                        waveLast.next = p;
                        p.prev = waveLast;
                        waveLast = p;
                    }
                    else {
                        waveLast = waveFirst = p;
                    }
                    // increase our particle count
                    ++this.particleCount;
                }
                if (waveFirst) {
                    // add particle to list of active particles
                    if (this._activeParticlesLast) {
                        this._activeParticlesLast.next = waveFirst;
                        waveFirst.prev = this._activeParticlesLast;
                        this._activeParticlesLast = waveLast;
                    }
                    else {
                        this._activeParticlesFirst = waveFirst;
                        this._activeParticlesLast = waveLast;
                    }
                    // run behavior init on particles
                    for (let i = 0; i < this.initBehaviors.length; ++i) {
                        const behavior = this.initBehaviors[i];
                        // if we hit our special key, interrupt behaviors to apply
                        // emitter position/rotation
                        if (behavior === PositionParticle) {
                            // 说实话这样不太好
                            addedCount = 0;
                            for (let particle = waveFirst, next; particle; particle = next) {
                                // save next particle in case we recycle this one
                                next = particle.next;
                                // rotate the particle's position by the emitter's rotation
                                if (this.rotation !== 0) {
                                    rotatePoint(this.rotation, particle.position);
                                    particle.rotation += this.rotation;
                                }
                                // offset by the emitter's position
                                particle.position.x += luckyDogs[addedCount].x;
                                particle.position.y += luckyDogs[addedCount].y;
                                // also, just update the particle's age properties while we are looping through
                                particle.age += luckyDogs[addedCount++].time;
                                // determine our interpolation value
                                let lerp = particle.age * particle.oneOverLife; // lifetime / maxLife;
                                // global ease affects all interpolation calculations
                                if (this.customEase) {
                                    if (this.customEase.length === 4) {
                                        // the t, b, c, d parameters that some tween libraries use
                                        // (time, initial value, end value, duration)
                                        lerp = this.customEase(lerp, 0, 1, 1);
                                    }
                                    else {
                                        // the simplified version that we like that takes
                                        // one parameter, time from 0-1. TweenJS eases provide this usage.
                                        lerp = this.customEase(lerp);
                                    }
                                }
                                // set age percent for all interpolation calculations
                                particle.agePercent = lerp;
                            }
                        }
                        else {
                            behavior.initParticles(waveFirst);
                        }
                    }
                }
            }
            else if (!this._emit) {
                this._distance = 0;
            }
            // update all particle lifetimes before turning them over to behaviors
            for (let particle = waveFirst ? waveFirst.prev : this._activeParticlesLast, prev; particle; particle = prev) {
                prev = particle.prev;
                if (addedCount >= this.maxParticles) {
                    // 新添加的粒子数可能会超出最大粒子数。为了保证尾迹的连续，应减去addedCount,而不是最大粒子数
                    this.recycles(this._activeParticlesFirst, this.particleCount - addedCount);
                    break;
                }
                particle.age += delta;
                if (particle.age > particle.maxLife || particle.age < 0) {
                    this.recycle(particle);
                    continue;
                }
                ++addedCount;
                // determine our interpolation value
                let lerp = particle.age * particle.oneOverLife; // lifetime / maxLife;
                // global ease affects all interpolation calculations
                if (this.customEase) {
                    if (this.customEase.length === 4) {
                        // the t, b, c, d parameters that some tween libraries use
                        // (time, initial value, end value, duration)
                        lerp = this.customEase(lerp, 0, 1, 1);
                    }
                    else {
                        // the simplified version that we like that takes
                        // one parameter, time from 0-1. TweenJS eases provide this usage.
                        lerp = this.customEase(lerp);
                    }
                }
                // set age percent for all interpolation calculations
                particle.agePercent = lerp;
                // let each behavior run wild on the active particles
                for (let i = 0; i < this.updateBehaviors.length; ++i) {
                    if (this.updateBehaviors[i].updateParticle(particle, delta)) {
                        this.recycle(particle);
                        break;
                    }
                }
            }
            for (let i = 0; i < this._attachedEmitters.length; ++i) {
                const emitter = this._attachedEmitters[i];
                if (!this._attachedEmitterConfigs[i].spawnWhenDrag || count > 0) {
                    emitter._emit = this._emit;
                    emitter.updateOwnerPos(curX, curY);
                }
                else {
                    emitter._emit = false;
                }
                if (this._attachedEmitterConfigs[i].updateTrail) {
                    emitter.updateTrail(delta);
                }
                else {
                    emitter.update(delta);
                }
            }
            // if the position changed before this update, then keep track of that
            if (this._posChanged) {
                this._prevPosIsValid = true;
                this._posChanged = false;
                this._prevEmitterPos.x = curX;
                this._prevEmitterPos.y = curY;
            }
            // if we are all done and should destroy ourselves, take care of that
            if (!this._emit && !this._activeParticlesFirst) {
                if (this._completeCallback) {
                    const cb = this._completeCallback;
                    this._completeCallback = null;
                    cb();
                }
                if (this._destroyWhenComplete) {
                    this.destroy();
                }
            }
        }
        addEmitter(emitter, config) {
            this._attachedEmitters.push(emitter);
            this._attachedEmitterConfigs.push(config);
            emitter.updateOwnerPos(this.ownerPos.x, this.ownerPos.y);
        }
        /**
         *  一次播放一些粒子,但频率为设定的频率
         */
        async emits(nums, x, y, rotation) {
            const curX = x || this.ownerPos.x + this.spawnPos.x;
            const curY = y || this.ownerPos.y + this.spawnPos.y;
            const curRotation = rotation || this.rotation;
            // spawn new particles
            if (this._emitterLife >= 0) {
                this._emitterLife -= this._frequency;
                if (this._emitterLife <= 0) {
                    this._spawnTimer = 0;
                    this._emitterLife = 0;
                    this.emit = false;
                    return;
                }
            }
            let waveFirst = null;
            let waveLast = null;
            for (let len = nums || this.particlesPerWave, i = 0; i < len; ++i) {
                // see if we actually spawn one
                if (this.spawnChance < 1 && Math.random() >= this.spawnChance) {
                    continue;
                }
                // determine the particle lifetime
                // let lifetime;
                // if (this.minLifetime === this.maxLifetime) {
                //     lifetime = this.minLifetime;
                // }
                // else {
                //     lifetime = (Math.random() * (this.maxLifetime - this.minLifetime)) + this.minLifetime;
                // }
                // // only make the particle if it wouldn't immediately destroy itself
                // if (-this._spawnTimer >= lifetime) {
                //     continue;
                // }
                // create particle
                let p;
                if (this._poolFirst) {
                    p = this._poolFirst;
                    this._poolFirst = this._poolFirst.next;
                    p.next = null;
                }
                else {
                    p = new Particle(this);
                }
                // initialize particle
                //p.init(lifetime);
                // add particles to list of ones in this wave
                if (waveFirst) {
                    waveLast.next = p;
                    p.prev = waveLast;
                    waveLast = p;
                }
                else {
                    waveLast = waveFirst = p;
                }
                // increase our particle count
                // ++this.particleCount;
            }
            if (waveFirst) {
                for (let i = 0; i < this.initBehaviors.length; ++i) {
                    const behavior = this.initBehaviors[i];
                    // if we hit our special key, interrupt behaviors to apply
                    // emitter position/rotation
                    if (behavior === PositionParticle) {
                        for (let particle = waveFirst, next; particle; particle = next) {
                            // save next particle in case we recycle this one
                            next = particle.next;
                            // rotate the particle's position by the emitter's rotation
                            if (curRotation !== 0) {
                                rotatePoint(curRotation, particle.position);
                                particle.rotation += curRotation;
                            }
                            // offset by the emitter's position
                            particle.position.x += curX;
                            particle.position.y += curY;
                            // also, just update the particle's age properties while we are looping through
                            particle.age += -this._spawnTimer;
                            // determine our interpolation value
                            let lerp = particle.age * particle.oneOverLife; // lifetime / maxLife;
                            // global ease affects all interpolation calculations
                            if (this.customEase) {
                                if (this.customEase.length === 4) {
                                    // the t, b, c, d parameters that some tween libraries use
                                    // (time, initial value, end value, duration)
                                    lerp = this.customEase(lerp, 0, 1, 1);
                                }
                                else {
                                    // the simplified version that we like that takes
                                    // one parameter, time from 0-1. TweenJS eases provide this usage.
                                    lerp = this.customEase(lerp);
                                }
                            }
                            // set age percent for all interpolation calculations
                            particle.agePercent = lerp;
                        }
                    }
                    else {
                        behavior.initParticles(waveFirst);
                    }
                }
                const unlock = await this._lock();
                this._emitsTaskList.push(waveFirst);
                this._emitsTaskTimer.push(0);
                unlock();
            }
        }
        /**
         * 用于emitTask和update的粒子链表的锁
         */
        async _lock() {
            const unlock = () => {
                if (this._waiting) {
                    const next = this._waiting;
                    this._waiting = null;
                    next(unlock);
                }
                else {
                    this._locked = false;
                }
            };
            if (this._locked) {
                return new Promise(resolve => {
                    this._waiting = resolve;
                });
            }
            else {
                this._locked = true;
                return unlock;
            }
        }
        /**
         * 按频率生成指定数量的粒子。不建议与emit = true一起使用
         * @param delta 时间间隔
         */
        async _emitTask(delta) {
            // const time0 = Date.now();
            const unlock = await this._lock();
            // const correctDelta = delta + (Date.now() - time0) / 1000;
            for (let i = 0; i < this._emitsTaskList.length;) {
                let particle = this._emitsTaskList[i];
                //let time = delta - this.frequency;
                this._emitsTaskTimer[i] += delta;
                while (this._emitsTaskTimer[i] >= 0) {
                    ++this.particleCount;
                    // add the particle to the display list
                    if (this.addAtBack) {
                        this._parent.addChildAt(particle, 0);
                    }
                    else {
                        this._parent.addChild(particle);
                    }
                    for (let k = 0; k < this.updateBehaviors.length; ++k) {
                        if (this.updateBehaviors[k].updateParticle(particle, this._emitsTaskTimer[i])) {
                            this.recycle(particle);
                            break;
                        }
                    }
                    if (particle.next == null) {
                        break;
                    }
                    particle = particle.next;
                    this._emitsTaskTimer[i] -= this._frequency;
                }
                if (this._activeParticlesLast) {
                    this._activeParticlesLast.next = this._emitsTaskList[i];
                    this._emitsTaskList[i].prev = this._activeParticlesLast;
                    this._activeParticlesLast = particle;
                }
                else {
                    this._activeParticlesLast = particle;
                    this._activeParticlesFirst = this._emitsTaskList[i];
                }
                if (particle.next) {
                    this._emitsTaskList[i] = particle.next;
                    particle.next.prev = null;
                    particle.next = null;
                    ++i;
                }
                else {
                    this._emitsTaskList.splice(i, 1);
                    this._emitsTaskTimer.splice(i, 1);
                }
            }
            unlock();
        }
        /**
         * 将位置移动到指定地方，但不触发update的那个插值
         * @param x x坐标
         * @param y y坐标
         */
        teleport(x, y) {
            this.ownerPos.x = x;
            this.ownerPos.y = y;
            this._prevPosIsValid = false;
        }
        /**
         * Kills all active particles immediately.
         */
        cleanup() {
            let particle;
            let next;
            for (particle = this._activeParticlesFirst; particle; particle = next) {
                next = particle.next;
                this.recycle(particle, true);
            }
            this._activeParticlesFirst = this._activeParticlesLast = null;
            this.particleCount = 0;
        }
        /**
         * If this emitter has been destroyed. Note that a destroyed emitter can still be reused, after
         * having a new parent set and being reinitialized.
         */
        get destroyed() {
            return !(this._parent && this.initBehaviors.length);
        }
        /**
         * Destroys the emitter and all of its particles.
         */
        destroy() {
            // make sure we aren't still listening to any tickers
            this.autoUpdate = false;
            // puts all active particles in the pool, and removes them from the particle parent
            this.cleanup();
            // wipe the pool clean
            let next;
            for (let particle = this._poolFirst; particle; particle = next) {
                // store next value so we don't lose it in our destroy call
                next = particle.next;
                particle.destroy();
            }
            this._poolFirst = this._parent = this.spawnPos = this.ownerPos
                = this.customEase = this._completeCallback = null;
            this.initBehaviors.length = this.updateBehaviors.length = this.recycleBehaviors.length = 0;
        }
    }
    Emitter.knownBehaviors = {};

    /**
     * Converts emitter configuration from pre-5.0.0 library values into the current version.
     *
     * Example usage:
     * ```javascript
     * const emitter = new Emitter(myContainer, upgradeConfig(myOldConfig, [myTexture, myOtherTexture]));
     * ```
     * @param config The old emitter config to upgrade.
     * @param art The old art values as would have been passed into the Emitter constructor or `Emitter.init()`
     */
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    function upgradeConfig(config, art) {
        // just ensure we aren't given any V3 config data
        if ('behaviors' in config) {
            return config;
        }
        const out = {
            lifetime: config.lifetime,
            ease: config.ease,
            particlesPerWave: config.particlesPerWave,
            frequency: config.frequency,
            spawnChance: config.spawnChance,
            emitterLifetime: config.emitterLifetime,
            maxParticles: config.maxParticles,
            addAtBack: config.addAtBack,
            pos: config.pos,
            emit: config.emit,
            autoUpdate: config.autoUpdate,
            behaviors: [],
            interval: 0.2
        };
        // set up the alpha
        if (config.alpha) {
            if ('start' in config.alpha) {
                if (config.alpha.start === config.alpha.end) {
                    if (config.alpha.start !== 1) {
                        out.behaviors.push({
                            type: 'alphaStatic',
                            config: { alpha: config.alpha.start },
                        });
                    }
                }
                else {
                    const list = {
                        list: [
                            { time: 0, value: config.alpha.start },
                            { time: 1, value: config.alpha.end },
                        ],
                    };
                    out.behaviors.push({
                        type: 'alpha',
                        config: { alpha: list },
                    });
                }
            }
            else if (config.alpha.list.length === 1) {
                if (config.alpha.list[0].value !== 1) {
                    out.behaviors.push({
                        type: 'alphaStatic',
                        config: { alpha: config.alpha.list[0].value },
                    });
                }
            }
            else {
                out.behaviors.push({
                    type: 'alpha',
                    config: { alpha: config.alpha },
                });
            }
        }
        // acceleration movement
        if (config.acceleration && (config.acceleration.x || config.acceleration.y)) {
            let minStart;
            let maxStart;
            if ('start' in config.speed) {
                minStart = config.speed.start * (config.speed.minimumSpeedMultiplier ?? 1);
                maxStart = config.speed.start;
            }
            else {
                minStart = config.speed.list[0].value * (config.minimumSpeedMultiplier ?? 1);
                maxStart = config.speed.list[0].value;
            }
            out.behaviors.push({
                type: 'moveAcceleration',
                config: {
                    accel: config.acceleration,
                    minStart,
                    maxStart,
                    rotate: !config.noRotation,
                    maxSpeed: config.maxSpeed,
                },
            });
        }
        // path movement
        else if (config.extraData?.path) {
            let list;
            let mult;
            if ('start' in config.speed) {
                mult = config.speed.minimumSpeedMultiplier ?? 1;
                if (config.speed.start === config.speed.end) {
                    list = {
                        list: [{ time: 0, value: config.speed.start }],
                    };
                }
                else {
                    list = {
                        list: [
                            { time: 0, value: config.speed.start },
                            { time: 1, value: config.speed.end },
                        ],
                    };
                }
            }
            else {
                list = config.speed;
                mult = (config.minimumSpeedMultiplier ?? 1);
            }
            out.behaviors.push({
                type: 'movePath',
                config: {
                    path: config.extraData.path,
                    speed: list,
                    minMult: mult,
                },
            });
        }
        // normal speed movement
        else {
            if (config.speed) {
                if ('start' in config.speed) {
                    if (config.speed.start === config.speed.end) {
                        out.behaviors.push({
                            type: 'moveSpeedStatic',
                            config: {
                                min: config.speed.start * (config.speed.minimumSpeedMultiplier ?? 1),
                                max: config.speed.start,
                            },
                        });
                    }
                    else {
                        const list = {
                            list: [
                                { time: 0, value: config.speed.start },
                                { time: 1, value: config.speed.end },
                            ],
                        };
                        out.behaviors.push({
                            type: 'moveSpeed',
                            config: { speed: list, minMult: config.speed.minimumSpeedMultiplier },
                        });
                    }
                }
                else if (config.speed.list.length === 1) {
                    out.behaviors.push({
                        type: 'moveSpeedStatic',
                        config: {
                            min: config.speed.list[0].value * (config.minimumSpeedMultiplier ?? 1),
                            max: config.speed.list[0].value,
                        },
                    });
                }
                else {
                    out.behaviors.push({
                        type: 'moveSpeed',
                        config: { speed: config.speed, minMult: (config.minimumSpeedMultiplier ?? 1) },
                    });
                }
            }
        }
        // scale
        if (config.scale) {
            if ('start' in config.scale) {
                const mult = config.scale.minimumScaleMultiplier ?? 1;
                if (config.scale.start === config.scale.end) {
                    out.behaviors.push({
                        type: 'scaleStatic',
                        config: {
                            min: config.scale.start * mult,
                            max: config.scale.start,
                        },
                    });
                }
                else {
                    const list = {
                        list: [
                            { time: 0, value: config.scale.start },
                            { time: 1, value: config.scale.end },
                        ],
                    };
                    out.behaviors.push({
                        type: 'scale',
                        config: { scale: list, minMult: mult },
                    });
                }
            }
            else if (config.scale.list.length === 1) {
                const mult = config.minimumScaleMultiplier ?? 1;
                const scale = config.scale.list[0].value;
                out.behaviors.push({
                    type: 'scaleStatic',
                    config: { min: scale * mult, max: scale },
                });
            }
            else {
                out.behaviors.push({
                    type: 'scale',
                    config: { scale: config.scale, minMult: config.minimumScaleMultiplier ?? 1 },
                });
            }
        }
        // color
        if (config.color) {
            if ('start' in config.color) {
                if (config.color.start === config.color.end) {
                    if (config.color.start !== 'ffffff') {
                        out.behaviors.push({
                            type: 'colorStatic',
                            config: { color: config.color.start },
                        });
                    }
                }
                else {
                    const list = {
                        list: [
                            { time: 0, value: config.color.start },
                            { time: 1, value: config.color.end },
                        ],
                    };
                    out.behaviors.push({
                        type: 'color',
                        config: { color: list },
                    });
                }
            }
            else if (config.color.list.length === 1) {
                if (config.color.list[0].value !== 'ffffff') {
                    out.behaviors.push({
                        type: 'colorStatic',
                        config: { color: config.color.list[0].value },
                    });
                }
            }
            else {
                out.behaviors.push({
                    type: 'color',
                    config: { color: config.color },
                });
            }
        }
        // rotation
        if (config.rotationAcceleration || config.rotationSpeed?.min || config.rotationSpeed?.max) {
            out.behaviors.push({
                type: 'rotation',
                config: {
                    accel: config.rotationAcceleration || 0,
                    minSpeed: config.rotationSpeed?.min || 0,
                    maxSpeed: config.rotationSpeed?.max || 0,
                    minStart: config.startRotation?.min || 0,
                    maxStart: config.startRotation?.max || 0,
                },
            });
        }
        else if (config.startRotation?.min || config.startRotation?.max) {
            out.behaviors.push({
                type: 'rotationStatic',
                config: {
                    min: config.startRotation?.min || 0,
                    max: config.startRotation?.max || 0,
                },
            });
        }
        if (config.noRotation) {
            out.behaviors.push({
                type: 'noRotation',
                config: {},
            });
        }
        // blend mode
        if (config.blendMode && config.blendMode !== 'normal') {
            out.behaviors.push({
                type: 'blendMode',
                config: {
                    blendMode: config.blendMode,
                },
            });
        }
        // animated
        if (Array.isArray(art) && typeof art[0] !== 'string' && 'framerate' in art[0]) {
            for (let i = 0; i < art.length; ++i) {
                if (art[i].framerate === 'matchLife') {
                    art[i].framerate = -1;
                }
            }
            out.behaviors.push({
                type: 'animatedRandom',
                config: {
                    anims: art,
                },
            });
        }
        else if (typeof art !== 'string' && 'framerate' in art) {
            if (art.framerate === 'matchLife') {
                art.framerate = -1;
            }
            out.behaviors.push({
                type: 'animatedSingle',
                config: {
                    anim: art,
                },
            });
        }
        // ordered art
        else if (config.orderedArt && Array.isArray(art)) {
            out.behaviors.push({
                type: 'textureOrdered',
                config: {
                    textures: art,
                },
            });
        }
        // random texture
        else if (Array.isArray(art)) {
            out.behaviors.push({
                type: 'textureRandom',
                config: {
                    textures: art,
                },
            });
        }
        // single texture
        else {
            out.behaviors.push({
                type: 'textureSingle',
                config: {
                    texture: art,
                },
            });
        }
        // spawn burst
        if (config.spawnType === 'burst') {
            out.behaviors.push({
                type: 'spawnBurst',
                config: {
                    start: config.angleStart || 0,
                    spacing: config.particleSpacing,
                    // older formats bursted from a single point
                    distance: 0,
                },
            });
        }
        // spawn point
        else if (config.spawnType === 'point') {
            out.behaviors.push({
                type: 'spawnPoint',
                config: {},
            });
        }
        // spawn shape
        else {
            let shape;
            if (config.spawnType === 'ring') {
                shape = {
                    type: 'torus',
                    data: {
                        x: config.spawnCircle.x,
                        y: config.spawnCircle.y,
                        radius: config.spawnCircle.r,
                        innerRadius: config.spawnCircle.minR,
                        affectRotation: true,
                    },
                };
            }
            else if (config.spawnType === 'circle') {
                shape = {
                    type: 'torus',
                    data: {
                        x: config.spawnCircle.x,
                        y: config.spawnCircle.y,
                        radius: config.spawnCircle.r,
                        innerRadius: 0,
                        affectRotation: false,
                    },
                };
            }
            else if (config.spawnType === 'rect') {
                shape = {
                    type: 'rect',
                    data: config.spawnRect,
                };
            }
            else if (config.spawnType === 'polygonalChain') {
                shape = {
                    type: 'polygonalChain',
                    data: config.spawnPolygon,
                };
            }
            if (shape) {
                out.behaviors.push({
                    type: 'spawnShape',
                    config: shape,
                });
            }
        }
        return out;
    }

    /*

    /!**
     * A semi-experimental Container that uses a doubly linked list to manage children instead of an
     * array. This means that adding/removing children often is not the same performance hit that
     * it would to be continually pushing/splicing.
     * However, this is primarily intended to be used for heavy particle usage, and may not handle
     * edge cases well if used as a complete Container replacement.
     *!/
    export class LinkedListContainer extends Container
    {
        private _firstChild: LinkedListChild|null = null;
        private _lastChild: LinkedListChild|null = null;
        private _childCount = 0;

        public get firstChild(): LinkedListChild
        {
            return this._firstChild;
        }

        public get lastChild(): LinkedListChild
        {
            return this._lastChild;
        }

        public get childCount(): number
        {
            return this._childCount;
        }

        public addChild<T extends DisplayObject[]>(...children: T): T[0]
        {
            // if there is only one argument we can bypass looping through the them
            if (children.length > 1)
            {
                // loop through the array and add all children
                for (let i = 0; i < children.length; i++)
                {
                    // eslint-disable-next-line prefer-rest-params
                    this.addChild(children[i]);
                }
            }
            else
            {
                const child = children[0] as LinkedListChild;
                // if the child has a parent then lets remove it as PixiJS objects can only exist in one place

                if (child.parent)
                {
                    child.parent.removeChild(child);
                }

                child.parent = this;
                this.sortDirty = true;

                // ensure child transform will be recalculated
                child.transform._parentID = -1;

                // add to list if we have a list
                if (this._lastChild)
                {
                    this._lastChild.nextChild = child;
                    child.prevChild = this._lastChild;
                    this._lastChild = child;
                }
                // otherwise initialize the list
                else
                {
                    this._firstChild = this._lastChild = child;
                }

                // update child count
                ++this._childCount;

                // ensure bounds will be recalculated
                this._boundsID++;

                // TODO - lets either do all callbacks or all events.. not both!
                this.onChildrenChange();
                this.emit('childAdded', child, this, this._childCount);
                child.emit('added', this);
            }

            return children[0];
        }

        public addChildAt<T extends DisplayObject>(child: T, index: number): T
        {
            if (index < 0 || index > this._childCount)
            {
                throw new Error(`addChildAt: The index ${index} supplied is out of bounds ${this._childCount}`);
            }

            if (child.parent)
            {
                child.parent.removeChild(child);
            }

            child.parent = this;
            this.sortDirty = true;

            // ensure child transform will be recalculated
            child.transform._parentID = -1;

            const c = (child as any) as LinkedListChild;

            // if no children, do basic initialization
            if (!this._firstChild)
            {
                this._firstChild = this._lastChild = c;
            }
            // add at beginning (back)
            else if (index === 0)
            {
                this._firstChild.prevChild = c;
                c.nextChild = this._firstChild;
                this._firstChild = c;
            }
            // add at end (front)
            else if (index === this._childCount)
            {
                this._lastChild.nextChild = c;
                c.prevChild = this._lastChild;
                this._lastChild = c;
            }
            // otherwise we have to start counting through the children to find the right one
            // - SLOW, only provided to fully support the possibility of use
            else
            {
                let i = 0;
                let target = this._firstChild;

                while (i < index)
                {
                    target = target.nextChild;
                    ++i;
                }
                // insert before the target that we found at the specified index
                target.prevChild.nextChild = c;
                c.prevChild = target.prevChild;
                c.nextChild = target;
                target.prevChild = c;
            }

            // update child count
            ++this._childCount;

            // ensure bounds will be recalculated
            this._boundsID++;

            // TODO - lets either do all callbacks or all events.. not both!
            this.onChildrenChange(index);
            child.emit('added', this);
            this.emit('childAdded', child, this, index);

            return child;
        }

        /!**
         * Adds a child to the container to be rendered below another child.
         *
         * @param child The child to add
         * @param relative - The current child to add the new child relative to.
         * @return The child that was added.
         *!/
        public addChildBelow<T extends DisplayObject>(child: T, relative: DisplayObject): T
        {
            if (relative.parent !== this)
            {
                throw new Error(`addChildBelow: The relative target must be a child of this parent`);
            }

            if (child.parent)
            {
                child.parent.removeChild(child);
            }

            child.parent = this;
            this.sortDirty = true;

            // ensure child transform will be recalculated
            child.transform._parentID = -1;

            // insert before the target that we were given
            (relative as LinkedListChild).prevChild.nextChild = (child as any as LinkedListChild);
            (child as any as LinkedListChild).prevChild = (relative as LinkedListChild).prevChild;
            (child as any as LinkedListChild).nextChild = (relative as LinkedListChild);
            (relative as LinkedListChild).prevChild = (child as any as LinkedListChild);
            if (this._firstChild === relative)
            {
                this._firstChild = (child as any as LinkedListChild);
            }

            // update child count
            ++this._childCount;

            // ensure bounds will be recalculated
            this._boundsID++;

            // TODO - lets either do all callbacks or all events.. not both!
            this.onChildrenChange();
            this.emit('childAdded', child, this, this._childCount);
            child.emit('added', this);

            return child;
        }

        /!**
         * Adds a child to the container to be rendered above another child.
         *
         * @param child The child to add
         * @param relative - The current child to add the new child relative to.
         * @return The child that was added.
         *!/
        public addChildAbove<T extends DisplayObject>(child: T, relative: DisplayObject): T
        {
            if (relative.parent !== this)
            {
                throw new Error(`addChildBelow: The relative target must be a child of this parent`);
            }

            if (child.parent)
            {
                child.parent.removeChild(child);
            }

            child.parent = this;
            this.sortDirty = true;

            // ensure child transform will be recalculated
            child.transform._parentID = -1;

            // insert after the target that we were given
            (relative as LinkedListChild).nextChild.prevChild = (child as any as LinkedListChild);
            (child as any as LinkedListChild).nextChild = (relative as LinkedListChild).nextChild;
            (child as any as LinkedListChild).prevChild = (relative as LinkedListChild);
            (relative as LinkedListChild).nextChild = (child as any as LinkedListChild);
            if (this._lastChild === relative)
            {
                this._lastChild = (child as any as LinkedListChild);
            }

            // update child count
            ++this._childCount;

            // ensure bounds will be recalculated
            this._boundsID++;

            // TODO - lets either do all callbacks or all events.. not both!
            this.onChildrenChange();
            this.emit('childAdded', child, this, this._childCount);
            child.emit('added', this);

            return child;
        }

        public swapChildren(child: DisplayObject, child2: DisplayObject): void
        {
            if (child === child2 || child.parent !== this || child2.parent !== this)
            {
                return;
            }

            const { prevChild, nextChild } = (child as LinkedListChild);

            (child as LinkedListChild).prevChild = (child2 as LinkedListChild).prevChild;
            (child as LinkedListChild).nextChild = (child2 as LinkedListChild).nextChild;
            (child2 as LinkedListChild).prevChild = prevChild;
            (child2 as LinkedListChild).nextChild = nextChild;

            if (this._firstChild === child)
            {
                this._firstChild = child2 as LinkedListChild;
            }
            else if (this._firstChild === child2)
            {
                this._firstChild = child as LinkedListChild;
            }
            if (this._lastChild === child)
            {
                this._lastChild = child2 as LinkedListChild;
            }
            else if (this._lastChild === child2)
            {
                this._lastChild = child as LinkedListChild;
            }

            this.onChildrenChange();
        }

        public getChildIndex(child: DisplayObject): number
        {
            let index = 0;
            let test = this._firstChild;

            while (test)
            {
                if (test === child)
                {
                    break;
                }
                test = test.nextChild;
                ++index;
            }
            if (!test)
            {
                throw new Error('The supplied DisplayObject must be a child of the caller');
            }

            return index;
        }

        setChildIndex(child: DisplayObject, index: number): void
        {
            if (index < 0 || index >= this._childCount)
            {
                throw new Error(`The index ${index} supplied is out of bounds ${this._childCount}`);
            }
            if (child.parent !== this)
            {
                throw new Error('The supplied DisplayObject must be a child of the caller');
            }

            // remove child
            if ((child as LinkedListChild).nextChild)
            {
                (child as LinkedListChild).nextChild.prevChild = (child as LinkedListChild).prevChild;
            }
            if ((child as LinkedListChild).prevChild)
            {
                (child as LinkedListChild).prevChild.nextChild = (child as LinkedListChild).nextChild;
            }
            if (this._firstChild === (child as LinkedListChild))
            {
                this._firstChild = (child as LinkedListChild).nextChild;
            }
            if (this._lastChild === (child as LinkedListChild))
            {
                this._lastChild = (child as LinkedListChild).prevChild;
            }
            (child as LinkedListChild).nextChild = null;
            (child as LinkedListChild).prevChild = null;

            // do addChildAt
            if (!this._firstChild)
            {
                this._firstChild = this._lastChild = (child as LinkedListChild);
            }
            else if (index === 0)
            {
                this._firstChild.prevChild = (child as LinkedListChild);
                (child as LinkedListChild).nextChild = this._firstChild;
                this._firstChild = (child as LinkedListChild);
            }
            else if (index === this._childCount)
            {
                this._lastChild.nextChild = (child as LinkedListChild);
                (child as LinkedListChild).prevChild = this._lastChild;
                this._lastChild = (child as LinkedListChild);
            }
            else
            {
                let i = 0;
                let target = this._firstChild;

                while (i < index)
                {
                    target = target.nextChild;
                    ++i;
                }
                target.prevChild.nextChild = (child as LinkedListChild);
                (child as LinkedListChild).prevChild = target.prevChild;
                (child as LinkedListChild).nextChild = target;
                target.prevChild = (child as LinkedListChild);
            }

            this.onChildrenChange(index);
        }

        public removeChild<T extends DisplayObject[]>(...children: T): T[0]
        {
            // if there is only one argument we can bypass looping through the them
            if (children.length > 1)
            {
                // loop through the arguments property and remove all children
                for (let i = 0; i < children.length; i++)
                {
                    this.removeChild(children[i]);
                }
            }
            else
            {
                const child = children[0] as LinkedListChild;

                // bail if not actually our child
                if (child.parent !== this) return null;

                child.parent = null;
                // ensure child transform will be recalculated
                child.transform._parentID = -1;

                // swap out child references
                if (child.nextChild)
                {
                    child.nextChild.prevChild = child.prevChild;
                }
                if (child.prevChild)
                {
                    child.prevChild.nextChild = child.nextChild;
                }
                if (this._firstChild === child)
                {
                    this._firstChild = child.nextChild;
                }
                if (this._lastChild === child)
                {
                    this._lastChild = child.prevChild;
                }
                // clear sibling references
                child.nextChild = null;
                child.prevChild = null;

                // update child count
                --this._childCount;

                // ensure bounds will be recalculated
                this._boundsID++;

                // TODO - lets either do all callbacks or all events.. not both!
                this.onChildrenChange();
                child.emit('removed', this);
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                this.emit('childRemoved', child, this);
            }

            return children[0];
        }

        public getChildAt(index: number): DisplayObject
        {
            if (index < 0 || index >= this._childCount)
            {
                throw new Error(`getChildAt: Index (${index}) does not exist.`);
            }

            if (index === 0)
            {
                return this._firstChild;
            }
            // add at end (front)
            else if (index === this._childCount)
            {
                return this._lastChild;
            }
            // otherwise we have to start counting through the children to find the right one
            // - SLOW, only provided to fully support the possibility of use
            let i = 0;
            let target = this._firstChild;

            while (i < index)
            {
                target = target.nextChild;
                ++i;
            }

            return target;
        }

        public removeChildAt(index: number): DisplayObject
        {
            const child = this.getChildAt(index) as LinkedListChild;

            // ensure child transform will be recalculated..
            child.parent = null;
            child.transform._parentID = -1;
            // swap out child references
            if (child.nextChild)
            {
                child.nextChild.prevChild = child.prevChild;
            }
            if (child.prevChild)
            {
                child.prevChild.nextChild = child.nextChild;
            }
            if (this._firstChild === child)
            {
                this._firstChild = child.nextChild;
            }
            if (this._lastChild === child)
            {
                this._lastChild = child.prevChild;
            }
            // clear sibling references
            child.nextChild = null;
            child.prevChild = null;

            // update child count
            --this._childCount;

            // ensure bounds will be recalculated
            this._boundsID++;

            // TODO - lets either do all callbacks or all events.. not both!
            this.onChildrenChange(index);
            child.emit('removed', this);
            this.emit('childRemoved', child, this, index);

            return child;
        }

        public removeChildren(beginIndex = 0, endIndex = this._childCount): DisplayObject[]
        {
            const begin = beginIndex;

            // because Container.destroy() has removeChildren(0, this.children.count), assume that an end index of 0
            // should actually be _childCount.
            if (endIndex === 0 && this._childCount > 0)
            {
                endIndex = this._childCount;
            }
            const end = endIndex;
            const range = end - begin;

            if (range > 0 && range <= end)
            {
                const removed: LinkedListChild[] = [];
                let child = this._firstChild;

                for (let i = 0; i <= end && child; ++i, child = child.nextChild)
                {
                    if (i >= begin)
                    {
                        removed.push(child);
                    }
                }

                // child before removed section
                const prevChild = removed[0].prevChild;
                // child after removed section
                const nextChild = removed[removed.length - 1].nextChild;

                if (!nextChild)
                {
                    // if we removed the last child, then the new last child is the one before
                    // the removed section
                    this._lastChild = prevChild;
                }
                else
                {
                    // otherwise, stitch the child before the section to the child after
                    nextChild.prevChild = prevChild;
                }
                if (!prevChild)
                {
                    // if we removed the first child, then the new first child is the one after
                    // the removed section
                    this._firstChild = nextChild;
                }
                else
                {
                    // otherwise stich the child after the section to the one before
                    prevChild.nextChild = nextChild;
                }

                for (let i = 0; i < removed.length; ++i)
                {
                    // clear parenting and sibling references for all removed children
                    removed[i].parent = null;
                    if (removed[i].transform)
                    {
                        removed[i].transform._parentID = -1;
                    }
                    removed[i].nextChild = null;
                    removed[i].prevChild = null;
                }

                this._boundsID++;

                this.onChildrenChange(beginIndex);

                for (let i = 0; i < removed.length; ++i)
                {
                    removed[i].emit('removed', this);
                    this.emit('childRemoved', removed[i], this, i);
                }

                return removed;
            }
            else if (range === 0 && this._childCount === 0)
            {
                return [];
            }

            throw new RangeError('removeChildren: numeric values are outside the acceptable range.');
        }

        /!**
         * Updates the transform on all children of this container for rendering.
         * Copied from and overrides PixiJS v5 method (v4 method is identical)
         *!/
        updateTransform(): void
        {
            this._boundsID++;

            this.transform.updateTransform(this.parent.transform);

            // TODO: check render flags, how to process stuff here
            this.worldAlpha = this.alpha * this.parent.worldAlpha;

            let child;
            let next;

            for (child = this._firstChild; child; child = next)
            {
                next = child.nextChild;

                if (child.visible)
                {
                    child.updateTransform();
                }
            }
        }

        /!**
         * Recalculates the bounds of the container.
         * Copied from and overrides PixiJS v5 method (v4 method is identical)
         *!/
        calculateBounds(): void
        {
            this._bounds.clear();

            this._calculateBounds();

            let child;
            let next;

            for (child = this._firstChild; child; child = next)
            {
                next = child.nextChild;

                if (!child.visible || !child.renderable)
                {
                    continue;
                }

                child.calculateBounds();

                // TODO: filter+mask, need to mask both somehow
                if (child._mask)
                {
                    const maskObject = ((child._mask as MaskData).maskObject || child._mask) as Container;

                    maskObject.calculateBounds();
                    this._bounds.addBoundsMask(child._bounds, maskObject._bounds);
                }
                else if (child.filterArea)
                {
                    this._bounds.addBoundsArea(child._bounds, child.filterArea);
                }
                else
                {
                    this._bounds.addBounds(child._bounds);
                }
            }

            this._bounds.updateID = this._boundsID;
        }

        /!**
         * Retrieves the local bounds of the displayObject as a rectangle object. Copied from and overrides PixiJS v5 method
         *!/
        public getLocalBounds(rect?: Rectangle, skipChildrenUpdate = false): Rectangle
        {
            // skip Container's getLocalBounds, go directly to DisplayObject
            const result = DisplayObject.prototype.getLocalBounds.call(this, rect);

            if (!skipChildrenUpdate)
            {
                let child;
                let next;

                for (child = this._firstChild; child; child = next)
                {
                    next = child.nextChild;

                    if (child.visible)
                    {
                        child.updateTransform();
                    }
                }
            }

            return result;
        }

        /!**
         * Renders the object using the WebGL renderer. Copied from and overrides PixiJS v5 method
         *!/
        render(renderer: Renderer): void
        {
            // if the object is not visible or the alpha is 0 then no need to render this element
            if (!this.visible || this.worldAlpha <= 0 || !this.renderable)
            {
                return;
            }

            // do a quick check to see if this element has a mask or a filter.
            if (this._mask || (this.filters && this.filters.length))
            {
                this.renderAdvanced(renderer);
            }
            else
            {
                this._render(renderer);

                let child;
                let next;

                // simple render children!
                for (child = this._firstChild; child; child = next)
                {
                    next = child.nextChild;
                    child.render(renderer);
                }
            }
        }

        /!**
         * Render the object using the WebGL renderer and advanced features. Copied from and overrides PixiJS v5 method
         *!/
        protected renderAdvanced(renderer: Renderer): void
        {
            renderer.batch.flush();

            const filters = this.filters;
            const mask = this._mask;

            // _enabledFilters note: As of development, _enabledFilters is not documented in pixi.js
            // types but is in code of current release (5.2.4).

            // push filter first as we need to ensure the stencil buffer is correct for any masking
            if (filters)
            {
                if (!this._enabledFilters)
                {
                    this._enabledFilters = [];
                }

                this._enabledFilters.length = 0;

                for (let i = 0; i < filters.length; i++)
                {
                    if (filters[i].enabled)
                    {
                        this._enabledFilters.push(filters[i]);
                    }
                }

                if (this._enabledFilters.length)
                {
                    renderer.filter.push(this, this._enabledFilters);
                }
            }

            if (mask)
            {
                renderer.mask.push(this, this._mask);
            }

            // add this object to the batch, only rendered if it has a texture.
            this._render(renderer);

            let child;
            let next;

            // now loop through the children and make sure they get rendered
            for (child = this._firstChild; child; child = next)
            {
                next = child.nextChild;
                child.render(renderer);
            }

            renderer.batch.flush();

            if (mask)
            {
                renderer.mask.pop(this);
            }

            if (filters && this._enabledFilters && this._enabledFilters.length)
            {
                renderer.filter.pop();
            }
        }

        /!**
         * Renders the object using the Canvas renderer. Copied from and overrides PixiJS Canvas mixin in V5 and V6.
         *!/
        // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
        renderCanvas(renderer: any): void
        {
            // if not visible or the alpha is 0 then no need to render this
            if (!this.visible || this.worldAlpha <= 0 || !this.renderable)
            {
                return;
            }

            if (this._mask)
            {
                renderer.maskManager.pushMask(this._mask);
            }

            (this as any)._renderCanvas(renderer);

            let child;
            let next;

            for (child = this._firstChild; child; child = next)
            {
                next = child.nextChild;
                (child as any).renderCanvas(renderer);
            }

            if (this._mask)
            {
                renderer.maskManager.popMask(renderer);
            }
        }
    }
    */

    Emitter.registerBehavior(AccelerationBehavior);
    Emitter.registerBehavior(AlphaBehavior);
    Emitter.registerBehavior(StaticAlphaBehavior);
    Emitter.registerBehavior(RandomAnimatedTextureBehavior);
    Emitter.registerBehavior(SingleAnimatedTextureBehavior);
    Emitter.registerBehavior(BlendModeBehavior);
    Emitter.registerBehavior(BurstSpawnBehavior);
    Emitter.registerBehavior(ColorBehavior);
    Emitter.registerBehavior(StaticColorBehavior);
    Emitter.registerBehavior(OrderedTextureBehavior);
    Emitter.registerBehavior(PathBehavior);
    Emitter.registerBehavior(PointSpawnBehavior);
    Emitter.registerBehavior(RandomTextureBehavior);
    Emitter.registerBehavior(RotationBehavior);
    Emitter.registerBehavior(StaticRotationBehavior);
    Emitter.registerBehavior(NoRotationBehavior);
    Emitter.registerBehavior(ScaleBehavior);
    Emitter.registerBehavior(StaticScaleBehavior);
    Emitter.registerBehavior(ShapeSpawnBehavior);
    Emitter.registerBehavior(SingleTextureBehavior);
    Emitter.registerBehavior(SpeedBehavior);
    Emitter.registerBehavior(StaticSpeedBehavior);
    Emitter.registerBehavior(LifetimeBehavior);
    Emitter.registerBehavior(StaticLifetimeBehavior);

    exports.Emitter = Emitter;
    exports.Particle = Particle;
    exports.ParticleUtils = ParticleUtils$1;
    exports.PropertyList = PropertyList;
    exports.PropertyNode = PropertyNode;
    exports.upgradeConfig = upgradeConfig;

})(this.PIXI.particles = this.PIXI.particles || {}, PIXI);
//# sourceMappingURL=particle-emitter.js.map
