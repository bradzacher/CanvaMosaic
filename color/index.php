<?php
    const TILE_WIDTH = 16;
    const TILE_HEIGHT = 16;

    // get the colour from the request URL
    $colour = $_GET['color'];
?>
<svg xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink" width="<?=TILE_WIDTH ?>" height="<?=TILE_HEIGHT ?>">
  <ellipse cx="50%" cy="50%" rx="50%" ry="50%" fill="#<?=$colour ?>"></ellipse>
</svg>
