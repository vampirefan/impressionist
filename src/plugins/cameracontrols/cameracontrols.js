/**
 * Camera-controls plugin
 *
 * Buttons to navigate the camera
 *
 * Copyright 2016 Henrik Ingo (@henrikingo)
 * Released under the MIT license.
 */
(function ( document, window ) {
    'use strict';
    var toolbar;
    var cameraCoordinates;
    var myWidgets = {};

    // Functions for zooming and panning the canvas //////////////////////////////////////////////

    // Create widgets and add them to the impressionist toolbar //////////////////////////////////
    var toNumber = function (numeric, fallback) {
        return isNaN(numeric) ? (fallback || 0) : Number(numeric);
    };

    var triggerEvent = function (el, eventName, detail) {
        var event = document.createEvent("CustomEvent");
        event.initCustomEvent(eventName, true, true, detail);
        el.dispatchEvent(event);
    };

    var makeDomElement = function ( html ) {
        var tempDiv = document.createElement("div");
        tempDiv.innerHTML = html;
        return tempDiv.firstChild;
    };

    var addCameraControls = function() {
        myWidgets.xy = makeDomElement( '<button id="impressionist-cameracontrols-xy" title="Pan camera left-right, up-down">+</button>' );
        myWidgets.z  = makeDomElement( '<button id="impressionist-cameracontrols-z" title="Zoom in-out = up-down, rotate = left-right">Z</button>' );
        myWidgets.rotateXY = makeDomElement( '<button id="impressionist-cameracontrols-rotate" title="Rotate camera left-right, up-down">O</button>' );

        triggerEvent(toolbar, "impressionist:toolbar:appendChild", { group : 0, element : myWidgets.xy } );
        triggerEvent(toolbar, "impressionist:toolbar:appendChild", { group : 0, element : myWidgets.z } );
        triggerEvent(toolbar, "impressionist:toolbar:appendChild", { group : 0, element : myWidgets.rotateXY } );

        var initDrag = function(event) {
            var drag = {};
            drag.start = {};
            drag.start.x = event.clientX;
            drag.start.y = event.clientY;
            drag.current = {};
            drag.current.x = event.clientX;
            drag.current.y = event.clientY;
            return drag;
        };
        var stopDrag = function() {
            myWidgets.xy.drag = false;
            myWidgets.z.drag = false;
            myWidgets.rotateXY.drag = false;
        };
        
        myWidgets.xy.addEventListener( "mousedown", function( event ) {
            myWidgets.xy.drag = initDrag(event);
            updateCameraCoordinatesFiber(); // start fiber
        });
        myWidgets.z.addEventListener( "mousedown", function( event ) {
            myWidgets.z.drag = initDrag(event);
            updateCameraCoordinatesFiber(); // start fiber
        });
        myWidgets.rotateXY.addEventListener( "mousedown", function( event ) {
            myWidgets.rotateXY.drag = initDrag(event);
            updateCameraCoordinatesFiber(); // start fiber
        });
        
        document.addEventListener( "mouseup", function( event ) {
            stopDrag();
        });
        document.addEventListener( "mouseleave", function( event ) {
            stopDrag();
        });
        
        document.addEventListener( "mousemove", function( event ) {
            if( myWidgets.xy.drag ) {
                myWidgets.xy.drag.current.x = event.clientX;
                myWidgets.xy.drag.current.y = event.clientY;
            }
            if( myWidgets.z.drag ) {
                myWidgets.z.drag.current.x = event.clientX;
                myWidgets.z.drag.current.y = event.clientY;
            }
            if( myWidgets.rotateXY.drag ) {
                myWidgets.rotateXY.drag.current.x = event.clientX;
                myWidgets.rotateXY.drag.current.y = event.clientY;
            }
        });
        
        var updateCameraCoordinatesFiber = function(){
            var diff = { x:0, y:0, z:0, rotateX:0, rotateY:0, rotateZ:0 };
            var isDragging = false;
            if( myWidgets.xy.drag ) {
                diff.x = myWidgets.xy.drag.current.x - myWidgets.xy.drag.start.x;
                diff.y = myWidgets.xy.drag.current.y - myWidgets.xy.drag.start.y;
                isDragging = true;
            }
            if( myWidgets.z.drag ) {
                diff.z = myWidgets.z.drag.current.y - myWidgets.z.drag.start.y;
                diff.rotateZ = myWidgets.z.drag.current.x - myWidgets.z.drag.start.x;
                isDragging = true;
            }
            if( myWidgets.rotateXY.drag ) {
                diff.rotateX = myWidgets.rotateXY.drag.current.y - myWidgets.rotateXY.drag.start.y;
                diff.rotateY = myWidgets.rotateXY.drag.current.x - myWidgets.rotateXY.drag.start.x;
                isDragging = true;
            }

            if( isDragging ) {
                diff = snapToGrid(diff);
                diff = coordinateTransformation(diff);
                var moveTo = {};
                var scale = toNumber(cameraCoordinates.scale.input.value, 1);
                moveTo.x = Number(cameraCoordinates.x.input.value) + diff.x * scale;
                moveTo.y = Number(cameraCoordinates.y.input.value) + diff.y * scale;
                moveTo.z = Number(cameraCoordinates.z.input.value) + diff.z * scale;
                moveTo.scale = Number(cameraCoordinates.scale.input.value) + diff.scale;
                moveTo.rotateX = Number(cameraCoordinates.rotateX.input.value) + diff.rotateX/10;
                moveTo.rotateY = Number(cameraCoordinates.rotateY.input.value) - diff.rotateY/10;
                moveTo.rotateZ = Number(cameraCoordinates.rotateZ.input.value) - diff.rotateZ/10;
                triggerEvent(toolbar, "impressionist:camera:setCoordinates", moveTo );
                setTimeout( updateCameraCoordinatesFiber, 100 );
            }
        };
        
        // Ignore small values in diff values.
        // For example, if the movement is 88 degrees in some direction, this should correct it to 
        // 90 degrees. Helper for updateCameraCoordinatesFiber().
        var snapToGrid = function(diff) {
            // To start, simply ignore any values < 5 pixels.
            // This creates 
            // - a 10x10 px square whithin which there won't be any movement
            // - outside of that, 10 px corridoors in each 90 degree direction, 
            //   within which small deviations from 90 degree angles are ignored.
            for( var k in diff ) {
                diff[k] = Math.abs(diff[k]) > 5 ? diff[k] : 0;
            }
            // For the z widget, attach it to full 90 degrees in the closest direction.
            // This means you can only zoom or rotate, not both at the same time.
            // Once a direction is chosen, lock that until dragStop() event.
            if( myWidgets.z.drag && myWidgets.z.drag.setzero ) {
                diff[myWidgets.z.drag.setzero] = 0;
            }
            else {
                if( Math.abs(diff.z) > Math.abs(diff.rotateZ) ) {
                    diff.rotateZ = 0;
                    myWidgets.z.drag.setzero = "rotateZ";
                }
                else if ( Math.abs(diff.z) < Math.abs(diff.rotateZ) ) {
                    diff.z = 0;
                    myWidgets.z.drag.setzero = "z";
                }
            }
            return diff;
        };
    };
    
    // Wait for camera plugin to initialize first
    
    document.addEventListener("impressionist:camera:init", function (event) {
        cameraCoordinates = event.detail.widgets;
        toolbar = document.getElementById("impressionist-toolbar");
        addCameraControls();
    }, false);



    // 3d coordinate transformations
    //
    // Without this, the controls work, but they will just modify the camera
    // window coordinates directly. If the camera was rotated, this no longer makes
    // sense. For example, setting rotate: z: to 180, would turn everything
    // upside down. Now, if you pull the "+" (xy) control up, you will
    // actually see the camera panning down.
    //
    // It's time for some serious math, so I've hid these here at the end.
    // We want the controls to move the camera relative to the current viewport/camera position,
    // not the origin of the xyz coordinates. These functions modify the diff object so that
    // the movements are according to current viewport.
    
    var coordinateTransformation = function(diff){
        var deg = function(rad) {
          return rad * (180 / Math.PI);
        };

        var rad = function(deg) {
          return deg * (Math.PI / 180);
        };
        
        var newDiff = {};

        var rotateX = toNumber( cameraCoordinates.rotateX.input.value );
        var rotateY = toNumber( cameraCoordinates.rotateY.input.value );
        var rotateZ = toNumber( cameraCoordinates.rotateZ.input.value );

        // Based on http://www.math.tau.ac.il/~dcor/Graphics/cg-slides/geom3d.pdf but omitting the use of matrix calculus.
        // I get quite nauseous by this level of math, so basically the below was done by a combination of
        // cargo culting and trial-and error. If you're a real mathematician and are reading this thinking that there's
        // a shorter and more elegant equivalent form to these formulas, then by all means tell me. (henrik.ingo@avoinelama.fi).
        newDiff.x = diff.x * Math.cos( rad(rotateZ) ) * Math.cos( rad(rotateY) )
                  - diff.y * Math.sin( rad(rotateZ) ) * Math.cos( rad(rotateY) )
                  + diff.z * Math.sin( rad(rotateY) );

        newDiff.y = diff.y * ( Math.cos( rad(rotateZ) ) * Math.cos( rad(rotateX) ) 
                             - Math.sin( rad(rotateX) ) * Math.sin( rad(rotateY) ) * Math.sin( rad(rotateZ) ) )
                  + diff.x * ( Math.sin( rad(rotateZ) ) * Math.cos( rad(rotateX) ) 
                             + Math.sin( rad(rotateY) ) * Math.sin( rad(rotateX) ) * Math.cos( rad(rotateZ) ) )
                  - diff.z *   Math.sin( rad(rotateX) ) * Math.cos( rad(rotateY) );

        newDiff.z = diff.z *   Math.cos( rad(rotateX) ) * Math.cos( rad(rotateY) )
                  + diff.y * ( Math.sin( rad(rotateY) ) * Math.sin( rad(rotateZ) ) * Math.cos( rad(rotateX) )
                             + Math.sin( rad(rotateX) ) * Math.cos( rad(rotateZ) ) )
                  + diff.x * ( Math.sin( rad(rotateZ) ) * Math.sin( rad(rotateX) ) 
                             - Math.sin( rad(rotateY) ) * Math.cos( rad(rotateZ) ) * Math.cos( rad(rotateX) ) );

        newDiff.rotateX = diff.rotateX;
        newDiff.rotateY = diff.rotateY;
        newDiff.rotateZ = diff.rotateZ;
        newDiff.scale = diff.scale;
        return newDiff;
    };
    







    
})(document, window);

