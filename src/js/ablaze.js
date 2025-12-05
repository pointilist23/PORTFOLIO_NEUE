// Simplified Ablaze.js - No controls version
var particles;
var lineColor;
var maxDist = 80;
var numParticles = 128;
var canvas;
var ctx;
var bumpmap;
var bumpmapEffect = 0.01;
var ringRadius = 200;
var centerX;
var centerY;
var positionMethod = 0; // Circle arrangement
var cmapCtx;
var cmapImg;
var cmapData;
var cmapLoaded = false;
var mouseX = 0;
var mouseY = 0;
var mouseInfluence = 700; // Radius of mouse influence
var mouseActive = false;

// RequestAnimationFrame shim
window.requestAnimFrame = (function(){
    return window.requestAnimationFrame || 
           window.webkitRequestAnimationFrame || 
           window.mozRequestAnimationFrame || 
           window.oRequestAnimationFrame || 
           window.msRequestAnimationFrame || 
           function(callback){
               window.setTimeout(callback, 1000 / 60);
           };
})();

// SimplexNoise implementation
var SimplexNoise = function() {
    this.offsetX = 0;
    this.offsetY = 0;
    this.scale = 200;
    
    var grad3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
                 [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
                 [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
    
    var p = [];
    for(var i=0; i<256; i++) {
        p[i] = Math.floor(Math.random()*256);
    }
    
    var perm = [];
    for(var i=0; i<512; i++) {
        perm[i]=p[i & 255];
    }
    
    var F2 = 0.5*(Math.sqrt(3.0)-1.0);
    var G2 = (3.0-Math.sqrt(3.0))/6.0;
    
    this.noise = function(xin, yin) {
        var n0, n1, n2;
        var s = (xin+yin)*F2;
        var i = Math.floor(xin+s);
        var j = Math.floor(yin+s);
        var t = (i+j)*G2;
        var X0 = i-t;
        var Y0 = j-t;
        var x0 = xin-X0;
        var y0 = yin-Y0;
        var i1, j1;
        if(x0>y0) {i1=1; j1=0;}
        else {i1=0; j1=1;}
        var x1 = x0 - i1 + G2;
        var y1 = y0 - j1 + G2;
        var x2 = x0 - 1.0 + 2.0 * G2;
        var y2 = y0 - 1.0 + 2.0 * G2;
        var ii = i & 255;
        var jj = j & 255;
        var gi0 = perm[ii+perm[jj]] % 12;
        var gi1 = perm[ii+i1+perm[jj+j1]] % 12;
        var gi2 = perm[ii+1+perm[jj+1]] % 12;
        var t0 = 0.5 - x0*x0-y0*y0;
        if(t0<0) n0 = 0.0;
        else {
            t0 *= t0;
            n0 = t0 * t0 * (grad3[gi0][0]*x0 + grad3[gi0][1]*y0);
        }
        var t1 = 0.5 - x1*x1-y1*y1;
        if(t1<0) n1 = 0.0;
        else {
            t1 *= t1;
            n1 = t1 * t1 * (grad3[gi1][0]*x1 + grad3[gi1][1]*y1);
        }
        var t2 = 0.5 - x2*x2-y2*y2;
        if(t2<0) n2 = 0.0;
        else {
            t2 *= t2;
            n2 = t2 * t2 * (grad3[gi2][0]*x2 + grad3[gi2][1]*y2);
        }
        return 70.0 * (n0 + n1 + n2);
    };
};

function initAblaze(canvasId){
    canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    ctx = canvas.getContext("2d");
    ctx.fillStyle = "rgba(0, 0, 0, 1)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    bumpmap = new SimplexNoise();
    bumpmap.offsetX = 0;
    bumpmap.offsetY = 0;
    bumpmap.scale = 200;
    
    centerX = canvas.width >> 1;
    centerY = canvas.height >> 1;
    ringRadius = Math.min(canvas.width, canvas.height) >> 2;
    
    lineColor = 0xffffff;
    
    // Add mouse event listeners
    canvas.addEventListener('mousemove', function(e) {
        var rect = canvas.getBoundingClientRect();
        mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
        mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
        mouseActive = true;
    });
    
    canvas.addEventListener('mouseleave', function() {
        mouseActive = false;
    });
    
    // Load colormap
    loadColorMap();
}

function loadColorMap() {
    cmapImg = new Image();
    cmapImg.onload = function() {
        // Create a hidden canvas to extract pixel data
        var tempCanvas = document.createElement('canvas');
        tempCanvas.width = 100;
        tempCanvas.height = 100;
        cmapCtx = tempCanvas.getContext("2d");
        cmapCtx.drawImage(cmapImg, 0, 0, 100, 100);
        cmapData = cmapCtx.getImageData(0, 0, 100, 100);
        cmapLoaded = true;
        
        // Now start the animation
        makeParticles();
        window.requestAnimFrame(oef);
    };
    cmapImg.onerror = function() {
        console.warn('Colormap not found, using default white color');
        cmapLoaded = false;
        makeParticles();
        window.requestAnimFrame(oef);
    };
    cmapImg.src = '/src/img/NA.webp';
}

function makeParticles(){
    particles = new Array(numParticles);
    var p;
    var i = -1;
    var propX, propY, data, col, row, rowWidth;
    
    while(++i < numParticles){
        p = {};
        particles[i] = p;
        p.angle = getRandomFromRange(0, Math.PI * 2);
        p.speed = getRandomFromRange(0.1, 3);
        setInitialPosition(p, positionMethod);
        p.distances = new Array(numParticles);
        p.px = p.x;
        p.py = p.y;
        
        // Get color from colormap based on particle position
        if (cmapLoaded && cmapData) {
            propX = p.x / canvas.width;
            propY = p.y / canvas.height;
            data = cmapData.data;
            col = Math.floor(propX * cmapData.width);
            row = Math.floor(propY * cmapData.height);
            rowWidth = cmapData.width;
            
            var index = (col + (row * rowWidth)) * 4;
            p.color = (data[index] << 16) | (data[index + 1] << 8) | data[index + 2];
        } else {
            p.color = 0xffffff;
        }
    }
}

function setInitialPosition(f_obj, f_method){
    if (!f_method){
        f_method = 0;
    }
    
    switch (f_method){
        // circle
        case 0:
            var ringAngle = getRandomFromRange(0, Math.PI * 2);
            f_obj.x = Math.cos(ringAngle) * ringRadius + centerX;
            f_obj.y = Math.sin(ringAngle) * ringRadius + centerY;
            break;
        
        //Horizontal Line
        case 1:
            f_obj.x = Math.random() * canvas.width;
            f_obj.y = canvas.height >> 1;
            break;
        
        //Random
        case 2:
            f_obj.x = Math.random() * canvas.width;
            f_obj.y = Math.random() * canvas.height;
            break;
    }
}

function oef(e){
    particles.forEach(moveParticle);
    particles.forEach(resetDistances);
    particles.forEach(getDistances);
    particles.forEach(drawLines);
    
    // Draw black circle in the center on top
    ctx.fillStyle = "rgba(0, 0, 0, 1)";
    ctx.beginPath();
    ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
    ctx.fill();
    
    window.requestAnimFrame(oef);
}

function moveParticle(f_obj, f_id, f_array){
    f_obj.px = f_obj.x;
    f_obj.py = f_obj.y;
    
    if (f_obj.x < 0 || f_obj.x > canvas.width || f_obj.y < 0 || f_obj.y > canvas.height){
        // Particle out of bounds
    } else {
        var colorVal = bumpmap.noise((bumpmap.offsetX + f_obj.x) / bumpmap.scale, (bumpmap.offsetY + f_obj.y) / bumpmap.scale);
        var angleOffset = bumpmapEffect * colorVal;
        f_obj.angle += angleOffset;
        
        // Mouse interaction - strong attraction to cursor
        if (mouseActive) {
            var dx = mouseX - f_obj.x;
            var dy = mouseY - f_obj.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < mouseInfluence && dist > 1) {
                var force = (1 - dist / mouseInfluence) * 3;
                var attractAngle = Math.atan2(dy, dx);
                f_obj.x += Math.cos(attractAngle) * force;
                f_obj.y += Math.sin(attractAngle) * force;
            }
        }
    }
    f_obj.x += Math.cos(f_obj.angle) * f_obj.speed;
    f_obj.y += Math.sin(f_obj.angle) * f_obj.speed;
}

function resetDistances(f_obj, f_id, f_array){
    f_obj.distances = new Array(numParticles);
}

function getDistances(f_obj, f_id, f_array){
    var dx;
    var dy;
    var i = -1;
    while(++i < numParticles){
        if (f_array[i].distances[f_id] == null){
            dx = f_array[i].x - f_obj.x;
            dy = f_array[i].y - f_obj.y;
            f_obj.distances[i] = Math.sqrt((dx * dx) + (dy * dy));
        }
    }
}

function drawLines(f_obj, f_id, f_array){
    var i = -1;
    var r;
    var g;
    var b;
    while(++i < numParticles){
        if (f_obj.distances[i] != null){
            if (f_obj.distances[i] < maxDist && f_obj.distances[i] > 1){
                r = f_obj.color >> 16;
                g = (f_obj.color >> 8) & 0xff;
                b = f_obj.color & 0xff;
                ctx.beginPath();
                ctx.strokeStyle = "rgba("+ r +","+ g +","+ b +","+ (0.2 - (0.2 * (f_obj.distances[i] / maxDist))) +")";
                ctx.moveTo(f_obj.x, f_obj.y);
                ctx.lineTo(f_array[i].x, f_array[i].y);
                ctx.stroke();
            }
        }
    }
}

function getRandomFromRange(f_min, f_max){
    return (Math.random() * (f_max - f_min)) + f_min;
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        initAblaze('ablazeCanvas');
    });
} else {
    initAblaze('ablazeCanvas');
}
