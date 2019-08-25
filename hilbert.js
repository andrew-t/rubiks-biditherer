// adapted from https://github.com/shkolovy/hilbert-curve-js/blob/master/HilbertCurve/base.js

function HilbertCurve() {
    var points = [];
    
    var Direction = {
        Left: 0,
        Right: 1,
        Up: 2,
        Down: 3
    };

    this.drawToSize = function(size) {
      return this.draw(Math.ceil(Math.log(size * size) / Math.log(4)));
    }
    
    this.draw = function(level) {
          points = [{ x: 0, y: 0 }];
          a(level);
          return points;
    };
    
    function a(level){
        if(level > 0){
            d(level - 1);
            drawLineTo(Direction.Right);
            a(level - 1);
            drawLineTo(Direction.Down);
            a(level - 1);
            drawLineTo(Direction.Left);
            c(level - 1);
        }
    }
    
    function b(level){
        if(level > 0){
            c(level - 1);
            drawLineTo(Direction.Left);
            b(level - 1);
            drawLineTo(Direction.Up);
            b(level - 1);
            drawLineTo(Direction.Right);
            d(level - 1);
        }
    }
    
    function c(level){
        if(level > 0){
            b(level - 1);
            drawLineTo(Direction.Up);
            c(level - 1);
            drawLineTo(Direction.Left);
            c(level - 1);
            drawLineTo(Direction.Down);
            a(level - 1);
        }
    }
    
    function d(level){
        if(level > 0){
            a(level - 1);
            drawLineTo(Direction.Down);
            d(level - 1);
            drawLineTo(Direction.Right);
            d(level - 1);
            drawLineTo(Direction.Up);
            b(level - 1);
        }
    }
    
    function drawLineTo(direction){
        const curvePenPosition = points[points.length - 1];
        switch (direction){
            case Direction.Up:
                 points.push({ x: curvePenPosition.x, y: curvePenPosition.y - 1 });
                 break;
            case Direction.Down:
                 points.push({ x: curvePenPosition.x, y: curvePenPosition.y + 1 });
                 break;
            case Direction.Left:
                 points.push({ x: curvePenPosition.x - 1, y: curvePenPosition.y });
                 break;
            default: //right
                 points.push({ x: curvePenPosition.x + 1, y: curvePenPosition.y });
                 break;
          }
    }
}
