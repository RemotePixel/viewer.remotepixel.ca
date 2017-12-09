"use strict";

mapboxgl.accessToken = '';
const landsat_tiler_url = '';
const sentinel_tiler_url = '';
const endpoint_token = '';

const sat_api = 'https://search.remotepixel.ca';

let scope = {};

////////////////////////////////////////////////////////////////////////////////
//From Libra by developmentseed (https://github.com/developmentseed/libra)
const zeroPad = (n, c) => {
  let s = String(n);
  if (s.length < c) s = zeroPad('0' + n, c);
  return s;
}

////////////////////////////////////////////////////////////////////////////////

const parseParams = (w_loc) => {
  const param_list = w_loc.replace('?', '').split('&')
  const out_params = {}
  for (let i = 0; i < param_list.length; i++) {
    let tPar = param_list[i].split('=');
    out_params[tPar[0]] = tPar[1]
  }
  return out_params;
};

const sortScenes = (a, b) => {
  return Date.parse(b.date) - Date.parse(a.date);
};

const parseSceneid_c1 = (sceneid) => {
  const sceneid_info = sceneid.split('_');
  return {
    satellite: sceneid_info[0].slice(0,1) + sceneid_info[0].slice(3),
    sensor:  sceneid_info[0].slice(1,2),
    correction_level: sceneid_info[1],
    path: sceneid_info[2].slice(0,3),
    row: sceneid_info[2].slice(3),
    acquisition_date: sceneid_info[3],
    ingestion_date: sceneid_info[4],
    collection: sceneid_info[5],
    category: sceneid_info[6]
  };
};

const parseSceneid_pre = (sceneid) => {
  return {
    sensor:  sceneid.slice(1,2),
    satellite: sceneid.slice(2,3),
    path: sceneid.slice(3,6),
    row: sceneid.slice(6,9),
    acquisitionYear: sceneid.slice(9,13),
    acquisitionJulianDay: sceneid.slice(13,16),
    groundStationIdentifier: sceneid.slice(16,19),
    archiveVersion: sceneid.slice(19,21)
  };
};

const parse_s2_tile = (tile) => {
  return {
    uz: tile.slice(0, 2),
    lb: tile.slice(2, 3),
    sq: tile.slice(3, 5)
  };
};

const s2_name_to_key = (scene) => {
  const info = scene.split('_');
  const acquisitionDate = info[2];
  const tile_info = parse_s2_tile(info[3]);
  const num = info[4];

  return [
    tile_info.uz.replace(/^0/, ''),
    tile_info.lb,
    tile_info.sq,
    acquisitionDate.slice(0,4),
    acquisitionDate.slice(4,6).replace(/^0+/, ''),
    acquisitionDate.slice(6,8).replace(/^0+/, ''),
    num
  ].join('/');
};

const buildQueryAndRequestL8 = (features) => {
  $('.list-img').scrollLeft(0);
  $('.list-img').empty();

  $(".scenes-info").addClass('none');
  $('.errorMessage').addClass('none');
  $(".metaloader").removeClass('off');
  $('#nodata-error').addClass('none');

  if (map.getSource('raster-tiles')) map.removeSource('raster-tiles');
  if (map.getLayer('raster-tiles')) map.removeLayer('raster-tiles');

  const results = [];

  Promise.all(features.map(e => {
    const row = zeroPad(e.properties.ROW, 3);
    const path = zeroPad(e.properties.PATH, 3);
    const query = `${sat_api}/landsat?row=${row}&path=${path}`;
    return $.getJSON(query).done()
      .then(data => {
        if (data.meta.found === 0) throw new Error('No image found in sat-api');
        return data.results;
      })
      .catch(err => {
        console.warn(err);
        return [];
      });
  }))
    .then(data => {
      data = [].concat.apply([], data);
      if (data.length === 0) throw new Error('No image found in sat-api');
      for (let i = 0; i < data.length; i += 1) {
        let scene = {};
        scene.path = data[i].path;
        scene.row = data[i].row;
        scene.date = data[i].date;
        scene.cloud = data[i].cloud_coverage;
        scene.browseURL = data[i].browseURL;
        scene.thumbURL = data[i].thumbURL;
        scene.scene_id = data[i].scene_id;
        scene.type = data[i].type;
        results.push(scene);
      }
      results.sort(sortScenes);

      for (let i = 0; i < results.length; i += 1) {
        $('.list-img').append(
          `<li data-row="${results[i].row}" data-path="${results[i].path}" data-type="${results[i].type}" data-date="${results[i].date}" data-cloud="${results[i].cloud}" class="list-element" onclick="initSceneL8('${results[i].scene_id}','${results[i].date}')" onmouseover="overImageL8(this)" onmouseout="outImageL8()">` +
            `<img class="img-item" src="${results[i].thumbURL}">` +
          '</li>'
        );
      }

      $('.map').addClass('in');
      $('.list-img').removeClass('none');
      $('#btn-clear').removeClass('none');
      map.resize();
    })
    .catch(err => {
      console.warn(err);
      $('#nodata-error').removeClass('none');
    })
    .then(() => {
      $(".metaloader").addClass('off');
    });
};

const buildQueryAndRequestS2 = (features) => {
  $('.list-img').scrollLeft(0);
  $('.list-img').empty();

  $(".scenes-info").addClass('none');
  $('.errorMessage').addClass('none');
  $('#nodata-error').addClass('none');
  $(".metaloader").removeClass('off');

  if (map.getSource('raster-tiles')) map.removeSource('raster-tiles');
  if (map.getLayer('raster-tiles')) map.removeLayer('raster-tiles');

  const results = [];

  Promise.all(features.map(e => {
    const utm = e.properties.Name.slice(0, 2);
    const lat = e.properties.Name.slice(2, 3);
    const grid = e.properties.Name.slice(3, 5);

    const query = `${sat_api}/sentinel?utm=${utm}&grid=${grid}&lat=${lat}`;
    return $.getJSON(query).done()
      .then(data => {
        if (data.meta.found === 0) throw new Error('No image found in sat-api');
        return data.results;
      })
      .catch(err => {
        console.warn(err);
        return [];
      });
  }))
    .then(data => {
      data = [].concat.apply([], data);
      if (data.length === 0) throw new Error('No image found in sat-api');
      for (let i = 0; i < data.length; i += 1) {
        let scene = {};
        scene.date = data[i].date
        scene.cloud = data[i].cloud;
        scene.browseURL = data[i].browseURL;
        scene.scene_id = data[i].scene_id;
        scene.tile = data[i].scene_id.split('_')[3];
        scene.sat = scene.scene_id.slice(0,3);
        results.push(scene);
      }
      results.sort(sortScenes);

      for (let i = 0; i < results.length; i += 1) {
        $('.list-img').append(
          `<li data-tile="${results[i].tile}" data-sat="${results[i].sat}" data-date="${results[i].date}" data-cloud="${results[i].cloud}" class="list-element" onclick="initSceneS2('${results[i].scene_id}','${results[i].date}')" onmouseover="overImageS2(this)" onmouseout="outImageS2()">` +
            `<img class="img-item" src="${results[i].browseURL}">` +
          '</li>'
        );
      }

      $('.map').addClass('in');
      $('.list-img').removeClass('none');
      $('#btn-clear').removeClass('none');
      map.resize();
    })
    .catch(err => {
      console.warn(err);
      $('#nodata-error').removeClass('none');
    })
    .then(() => {
      $(".metaloader").addClass('off');
    });
};

const overImageL8 = (element) => {
  let hoverstr = [
    'all',
    ['==', 'PATH', parseInt($(element)[0].getAttribute('data-path'))],
    ['==', 'ROW', parseInt($(element)[0].getAttribute('data-row'))]
  ];
  map.setFilter("L8_Highlighted", hoverstr);

  const sceneType = $(element)[0].getAttribute('data-type');
  const sceneDate = $(element)[0].getAttribute('data-date');
  const sceneCloud = $(element)[0].getAttribute('data-cloud');
  $('.img-over-info').empty();
  $('.img-over-info').removeClass('none');
  $('.img-over-info').append(`<span>${sceneType} | ${sceneDate} | ${sceneCloud}% </span>`);
};

const outImageL8 = () => {
  map.setFilter("L8_Highlighted", ['all', ['==', 'PATH', ''], ['==', 'ROW', '']]);
  $('.img-over-info').addClass('none');
};

const overImageS2 = (element) => {
  const tile = $(element)[0].getAttribute('data-tile');
  map.setFilter("S2_Highlighted", ['in', 'Name', tile]);

  const sceneSat = $(element)[0].getAttribute('data-sat');
  const sceneDate = $(element)[0].getAttribute('data-date');
  const sceneCloud = $(element)[0].getAttribute('data-cloud');
  $('.img-over-info').empty();
  $('.img-over-info').removeClass('none');
  $('.img-over-info').append(`<span>${sceneSat} | ${sceneDate} | ${sceneCloud}% </span>`);
};

const outImageS2 = () => {
  map.setFilter("S2_Highlighted", ['in', 'Name', '']);
  $('.img-over-info').addClass('none');
};

const initSceneL8 = (sceneID, sceneDate) => {
  $(".metaloader").removeClass('off');
  $('.errorMessage').addClass('none');
  $('#dl').addClass('none');

  let min = $("#minCount").val();
  let max = $("#maxCount").val();
  const query = `${landsat_tiler_url}/metadata/${sceneID}?'pmim=${min}&pmax=${max}&access_token=${endpoint_token}`;

  $.getJSON(query).done()
    .then(data => {
      scope.imgMetadata = data;
      updateRasterTile();

      let scene_info;
      if (/L[COTEM]08_L\d{1}[A-Z]{2}_\d{6}_\d{8}_\d{8}_\d{2}_(T1|RT)/.exec(sceneID)) {
          scene_info = parseSceneid_c1(sceneID);
      } else {
          scene_info = parseSceneid_pre(sceneID);
      }

      const AWSurl = `https://landsatonaws.com/L8/${scene_info.path}/${scene_info.row}/${sceneID}`;
      $(".scenes-info").removeClass('none');
      $(".scenes-info .id").text(sceneID);
      $(".scenes-info .date").text(sceneDate);
      $(".scenes-info .url").html(`<a href=${AWSurl} target="_blanck">link</a>`);

      $('#dl').removeClass('none');
      $('.errorMessage').addClass('none');
    })
    .catch(err => {
      console.warn(err);
      if (map.getSource('raster-tiles')) map.removeSource('raster-tiles');
      if (map.getLayer('raster-tiles')) map.removeLayer('raster-tiles');
      $('.errorMessage').removeClass('none');
      $(".scenes-info span").text('');
      $(".scenes-info").addClass('none');
    })
    .then(() => {
      $('.metaloader').addClass('off');
    });
};

const initSceneS2 = (sceneID, sceneDate) => {
  $(".metaloader").removeClass('off');
  $('.errorMessage').addClass('none');
  $('#dl').addClass('none');

  let min = $("#minCount").val();
  let max = $("#maxCount").val();
  const query = `${sentinel_tiler_url}/metadata/${sceneID}?'pmim=${min}&pmax=${max}&access_token=${endpoint_token}`;

  $.getJSON(query).done()
    .then(data => {
      scope.imgMetadata = data;
      updateRasterTile();

      let key = s2_name_to_key(sceneID);

      const AWSurl = `http://sentinel-s2-l1c.s3-website.eu-central-1.amazonaws.com/#tiles/${key}/`;
      $(".scenes-info").removeClass('none');
      $(".scenes-info .id").text(sceneID);
      $(".scenes-info .date").text(sceneDate);
      $(".scenes-info .url").html(`<a href=${AWSurl} target="_blanck">link</a>`);

      $('#dl').removeClass('none');
      $('.errorMessage').addClass('none');
    })
    .catch(err => {
      console.warn(err.responseJSON);
      if (map.getSource('raster-tiles')) map.removeSource('raster-tiles');
      if (map.getLayer('raster-tiles')) map.removeLayer('raster-tiles');
      $('.errorMessage').removeClass('none');
      $(".scenes-info span").text('');
      $(".scenes-info").addClass('none');
    })
    .then(() => {
      $('.metaloader').addClass('off');
    });
};

const updateRasterTile = () => {
  if (map.getLayer('raster-tiles')) map.removeLayer('raster-tiles');
  if (map.getSource('raster-tiles')) map.removeSource('raster-tiles');

  const sat = $(".map-top-right .toggle-group input:checked")[0].getAttribute('sat');
  const meta = scope.imgMetadata;
  let attrib;
  let maxzoom;
  let rgb;
  let histo_cuts;
  let endpoint;
  let url;

  let params = {
    'tile': '256',
    'access_token': endpoint_token
  };

  if (sat == 'sentinel') {
    endpoint = sentinel_tiler_url;
    attrib = '<span> &copy; Copernicus / ESA 2017</span>';
    maxzoom = 15;
  } else {
    endpoint = landsat_tiler_url;
    attrib = '<a href="https://landsat.usgs.gov/landsat-8"> &copy; USGS/NASA Landsat</a>';
    maxzoom = 14;
  }

  // RGB
  if ($('#rgb').hasClass('active')) {
    const r = document.getElementById('r').value;
    const g = document.getElementById('g').value;
    const b = document.getElementById('b').value;
    params.rgb = [r, g, b].join(',');
    params.histo = `${meta.rgbMinMax[r]}-${meta.rgbMinMax[g]}-${meta.rgbMinMax[b]}`;
    if (rgb == '4,3,2' && sat === 'landsat') params.pan = 'True';
    url = `${endpoint}/tiles/${meta.sceneid}/{z}/{x}/{y}.png`;

  // BAND
  } else if ($('#band').hasClass('active')) {
    const band = $('#band-buttons button.active')[0].getAttribute('value');
    params.rgb = band;
    params.histo = `${meta.rgbMinMax[band]}`;
    url = `${endpoint}/tiles/${meta.sceneid}/{z}/{x}/{y}.png`;

  // PROCESSING
  } else if ($('#process').hasClass('active')) {
    url = `${endpoint}/processing/${meta.sceneid}/{z}/{x}/{y}.png`;
    params.ratio = document.getElementById('ratio-selection').value;
  }

  const url_params = Object.keys(params).map(i => `${i}=${params[i]}`).join('&');

  $(".scenes-info .rgb").text(rgb);

  // NOTE: Calling 512x512px tiles is a bit longer but gives a
  // better quality image and reduce the number of tiles requested

  // HACK: Trade-off between quality and speed. Setting source.tileSize to 512 and telling landsat-tiler
  // to get 256x256px reduces the number of lambda calls (but they are faster)
  // and reduce the quality because MapboxGl will oversample the tile.

  map.addSource('raster-tiles', {
    type: "raster",
    tiles: [ `${url}?${url_params}` ],
    attribution : attrib,
    bounds: scope.imgMetadata.bounds,
    minzoom: 7,
    maxzoom: maxzoom,
    tileSize: 512 //params.tile
  });

  map.addLayer({
    'id': 'raster-tiles',
    'type': 'raster',
    'source': 'raster-tiles'
  });

  const extent = scope.imgMetadata.bounds;
  const llb = mapboxgl.LngLatBounds.convert([[extent[0],extent[1]], [extent[2],extent[3]]]);
  if (map.getZoom() <= 3) map.fitBounds(llb, {padding: 50});
};


const updateMetadata = () => {
  if (!map.getSource('raster-tiles')) return;
  const sat = $(".map-top-right .toggle-group input:checked")[0].getAttribute('sat');
  if (sat == 'sentinel') {
    initSceneS2(scope.imgMetadata.sceneid, scope.imgMetadata.date);
  } else {
    initSceneL8(scope.imgMetadata.sceneid, scope.imgMetadata.date);
  }
};


const reset = () => {
  if (map.getLayer('raster-tiles')) map.removeLayer('raster-tiles');
  if (map.getSource('raster-tiles')) map.removeSource('raster-tiles');

  map.setFilter("S2_Highlighted", ["in", "Name", ""]);
  map.setFilter("S2_Selected", ["in", "Name", ""]);

  map.setFilter("L8_Highlighted", ["in", "PATH", ""]);
  map.setFilter("L8_Selected", ["in", "PATH", ""]);

  $('.list-img').scrollLeft(0);
  $('.list-img').empty();

  $(".metaloader").addClass('off');
  $(".scenes-info span").text('');
  $(".scenes-info").addClass('none');
  $('#btn-clear').addClass('none');
  $('#dl').addClass('none');

  scope = {};

  $("#minCount").val(5);
  $("#maxCount").val(95);

  $('.map').removeClass('in');
  $('.list-img').addClass('none');
  map.resize();

  $('.errorMessage').addClass('none');
};


const getFeatures = (e) => {

  const sat = $(".map-top-right .toggle-group input:checked")[0].getAttribute('sat');
  let features;
  let pr;

  if (sat == 'sentinel') {
    pr = ["==", "Name", ""];
    features = map.queryRenderedFeatures(e.point, {layers: ['S2_Grid']});
    if (features.length !== 0) {
      pr = [].concat.apply([], ['any', features.map(e => {
        return ["==", "Name", e.properties.Name];
      })]);
    }
    map.setFilter("S2_Highlighted", pr);
  } else {
    pr = ["in", "PATH", ""];
    features = map.queryRenderedFeatures(e.point, {layers: ['L8_Grid']});
    if (features.length !== 0) {
      pr =  [].concat.apply([], ['any', features.map(e => {
        return ["all", ["==", "PATH", e.properties.PATH], ["==", "ROW", e.properties.ROW]];
      })]);
    }
    map.setFilter("L8_Highlighted", pr);
  }
  return features;
};


const switchPane = (event) => {
  $('#toolbar li').removeClass('active');
  $('#menu-content section').removeClass('active');
  $(`#toolbar #${event.id}`).addClass('active');
  $(`#menu-content #${event.id}`).addClass('active');

  if (event.id === 'process') {
    $('#params').addClass('none');
  } else $('#params').removeClass('none');

  if (map.getSource('raster-tiles')) updateRasterTile();
};

document.getElementById("rgb-selection").addEventListener("change", (e) => {
  let rgb = e.target.value;
  if (rgb === 'custom') {
    $('#rgb-buttons select').prop('disabled', false);
  } else {
    $('#rgb-buttons select').prop('disabled', true);
    rgb = rgb.split(',');
    document.getElementById('r').value = rgb[0];
    document.getElementById('g').value = rgb[1];
    document.getElementById('b').value = rgb[2];
    if (map.getSource('raster-tiles')) updateRasterTile();
  }
});

document.getElementById("r").addEventListener("change", () => {
  if (document.getElementById("rgb-selection").value !== 'custom') return;
  if (map.getSource('raster-tiles')) updateRasterTile();
});

document.getElementById("g").addEventListener("change", () => {
  if (document.getElementById("rgb-selection").value !== 'custom') return;
  if (map.getSource('raster-tiles')) updateRasterTile();
});

document.getElementById("b").addEventListener("change", () => {
  if (document.getElementById("rgb-selection").value !== 'custom') return;
  if (map.getSource('raster-tiles')) updateRasterTile();
});

document.getElementById("ratio-selection").addEventListener("change", () => {
  if (map.getSource('raster-tiles')) updateRasterTile();
});

const updateBands = (e) => {
  $('#band-buttons .btn').removeClass('active');
  $(e).addClass('active');
  if (map.getSource('raster-tiles')) updateRasterTile();
};

document.getElementById("btn-clear").onclick = () => { reset(); };

document.getElementById('dl').addEventListener('click', () => {
  map.getCanvas().toBlob(function(blob) {
    const imgName = `${scope.imgMetadata.sceneid}.png`
    saveAs(blob, imgName);
  });
});

document.getElementById('btn-hide').addEventListener('click', () => {
  $('#left').toggleClass('none');
  $('#right').toggleClass('none');
  $('#menu').toggleClass('off');
});

const showSiteInfo = () => {
  $('.site-info').toggleClass('in');
  map.resize();
};


const updateSat= () => {
  reset();

  const sat = $(".map-top-right .toggle-group input:checked")[0].getAttribute('sat');
  if (sat == 'sentinel') {
    ['L8_Grid', 'L8_Highlighted', 'L8_Selected'].forEach(function (e) {
      map.setLayoutProperty(e, 'visibility', 'none');
    });
    ['S2_Grid', 'S2_Highlighted', 'S2_Selected'].forEach(function (e) {
      map.setLayoutProperty(e, 'visibility', 'visible');
    });
    sentinelUI();
  } else {
    ['S2_Grid', 'S2_Highlighted', 'S2_Selected'].forEach(function (e) {
      map.setLayoutProperty(e, 'visibility', 'none');
    });
    ['L8_Grid', 'L8_Highlighted', 'L8_Selected'].forEach(function (e) {
      map.setLayoutProperty(e, 'visibility', 'visible');
    });
    landsatUI();
  }
};

const landsatUI = () => {
  $('#rgb-selection').empty();
  $('#rgb-selection').append(
    '<option value="4,3,2">Natural Color (4,3,2)</option>' +
    '<option value="7,6,4">False Color Urban (7,6,4)</option>' +
    '<option value="5,4,3">Color Infrared Vegetation (5,4,3)</option>' +
    '<option value="6,5,2">Agriculture (6,5,2)</option>' +
    '<option value="7,6,5">Atmospheric Penetration (7,6,5)</option>' +
    '<option value="5,6,2">Healthy Vegetation (5,6,2)</option>' +
    '<option value="7,5,2">Forest Burn (7,5,2)</option>' +
    '<option value="5,6,4">Land/Water (5,6,4)</option>' +
    '<option value="7,5,3">Natural With Atmo Removal (7,5,3)</option>' +
    '<option value="7,5,4">Shortwave Infrared (7,5,4)</option>' +
    '<option value="5,7,1">False color 2 (5,7,1)</option>' +
    '<option value="6,5,4">Vegetation Analysis (6,5,4)</option>' +
    '<option value="custom">Custom</option>');

  ['r', 'g', 'b'].forEach(e => {
    $(`#${e}`).empty();
    $(`#${e}`).append(
      '<option value="1">01</option>' +
      '<option value="2">02</option>' +
      '<option value="3">03</option>' +
      '<option value="4">04</option>' +
      '<option value="5">05</option>' +
      '<option value="6">06</option>' +
      '<option value="7">07</option>' +
      '<option value="9">09</option>' +
      '<option value="10">10</option>' +
      '<option value="11">11</option>');
  });
  $('#r option[value="4"]').attr('selected', 'selected');
  $('#g option[value="3"]').attr('selected', 'selected');
  $('#b option[value="2"]').attr('selected', 'selected');

  $('#band-buttons').empty();
  $('#band-buttons').append(
    '<button onclick="updateBands(this)" value="1" class="btn btn--stroke btn--stroke--2 mx6 my6 txt-m active">01</button>' +
    '<button onclick="updateBands(this)" value="2" class="btn btn--stroke btn--stroke--2 mx6 my6 txt-m">02</button>' +
    '<button onclick="updateBands(this)" value="3" class="btn btn--stroke btn--stroke--2 mx6 my6 txt-m">03</button>' +
    '<button onclick="updateBands(this)" value="4" class="btn btn--stroke btn--stroke--2 mx6 my6 txt-m">04</button>' +
    '<button onclick="updateBands(this)" value="5" class="btn btn--stroke btn--stroke--2 mx6 my6 txt-m">05</button>' +
    '<button onclick="updateBands(this)" value="6" class="btn btn--stroke btn--stroke--2 mx6 my6 txt-m">06</button>' +
    '<button onclick="updateBands(this)" value="7" class="btn btn--stroke btn--stroke--2 mx6 my6 txt-m">07</button>' +
    '<button onclick="updateBands(this)" value="9" class="btn btn--stroke btn--stroke--2 mx6 my6 txt-m">09</button>' +
    '<button onclick="updateBands(this)" value="10" class="btn btn--stroke btn--stroke--2 mx6 my6 txt-m">10</button>' +
    '<button onclick="updateBands(this)" value="11" class="btn btn--stroke btn--stroke--2 mx6 my6 txt-m">11</button>');

  $('#ratio-selection').empty();
  $('#ratio-selection').append(
    '<option value="ndvi">NDVI</option>' +
    '<option value="ndsi">NDSI</option>' +
    '<option value="ndwi">NDWI</option>' +
    '<option value="ac-index">AC-Index</option>');
};


const sentinelUI = () => {
  $('#rgb-selection').empty();
  $('#rgb-selection').append(
    '<option value="04,03,02">Natural Color (04,03,02)</option>' +
    '<option value="11,8A,04">Vegetation Analysis (11,8A,04)</option>' +
    '<option value="12,11,04">False Color Urban (12,11,04)</option>' +
    '<option value="08,04,03">Color Infrared Vegetation (08,04,03)</option>' +
    '<option value="12,11,8A">Atmospheric Penetration (12,11,8A)</option>' +
    '<option value="8A,11,02">Healthy Vegetation (8A,11,02)</option>' +
    '<option value="11,8A,02">Agriculture (11,8A,02)</option>' +
    '<option value="8A,11,04">Land/Water (8A,11,04)</option>' +
    '<option value="12,8A,04">Shortwave Infrared (7,5,4)</option>' +
    '<option value="custom">Custom</option>');

  ['r', 'g', 'b'].forEach(e => {
    $(`#${e}`).empty();
    $(`#${e}`).append(
      '<option value="01">01</option>' +
      '<option value="02">02</option>' +
      '<option value="03">03</option>' +
      '<option value="04">04</option>' +
      '<option value="05">05</option>' +
      '<option value="06">06</option>' +
      '<option value="07">07</option>' +
      '<option value="08">08</option>' +
      '<option value="8A">8A</option>' +
      '<option value="09">09</option>' +
      '<option value="10">10</option>' +
      '<option value="11">11</option>' +
      '<option value="12">12</option>')
  });
  $('#r option[value="04"]').attr('selected', 'selected');
  $('#g option[value="03"]').attr('selected', 'selected');
  $('#b option[value="02"]').attr('selected', 'selected');

  $('#band-buttons').empty();
  $('#band-buttons').append(
    '<button onclick="updateBands(this)" value="01" class="btn btn--stroke btn--stroke--2 mx6 my6 txt-m active">01</button>' +
    '<button onclick="updateBands(this)" value="02" class="btn btn--stroke btn--stroke--2 mx6 my6 txt-m">02</button>' +
    '<button onclick="updateBands(this)" value="03" class="btn btn--stroke btn--stroke--2 mx6 my6 txt-m">03</button>' +
    '<button onclick="updateBands(this)" value="04" class="btn btn--stroke btn--stroke--2 mx6 my6 txt-m">04</button>' +
    '<button onclick="updateBands(this)" value="05" class="btn btn--stroke btn--stroke--2 mx6 my6 txt-m">05</button>' +
    '<button onclick="updateBands(this)" value="06" class="btn btn--stroke btn--stroke--2 mx6 my6 txt-m">06</button>' +
    '<button onclick="updateBands(this)" value="07" class="btn btn--stroke btn--stroke--2 mx6 my6 txt-m">07</button>' +
    '<button onclick="updateBands(this)" value="08" class="btn btn--stroke btn--stroke--2 mx6 my6 txt-m">08</button>' +
    '<button onclick="updateBands(this)" value="8A" class="btn btn--stroke btn--stroke--2 mx6 my6 txt-m">8A</button>' +
    '<button onclick="updateBands(this)" value="09" class="btn btn--stroke btn--stroke--2 mx6 my6 txt-m">09</button>' +
    '<button onclick="updateBands(this)" value="10" class="btn btn--stroke btn--stroke--2 mx6 my6 txt-m">10</button>' +
    '<button onclick="updateBands(this)" value="11" class="btn btn--stroke btn--stroke--2 mx6 my6 txt-m">11</button>' +
    '<button onclick="updateBands(this)" value="12" class="btn btn--stroke btn--stroke--2 mx6 my6 txt-m">12</button>');

    $('#ratio-selection').empty();
    $('#ratio-selection').append(
      '<option value="ndvi">NDVI</option>' +
      '<option value="ndsi">NDSI</option>');
};

document.getElementById('satellite-toggle').addEventListener('change', updateSat);

var map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/satellite-streets-v9',
  center: [-70.50, 40],
  zoom: 3,
  attributionControl: true,
  preserveDrawingBuffer: true,
  minZoom: 3,
  maxZoom: 15
});

map.addControl(new mapboxgl.NavigationControl(), 'top-right');

map.on('mousemove', (e) => {getFeatures(e);});

map.on('click', (e) => {
    $('.errorMessage').addClass('none');
    const features = getFeatures(e);
    if (features.length !== 0) {
        const sat = $(".map-top-right .toggle-group input:checked")[0].getAttribute('sat');
        if (sat == 'sentinel') {
            buildQueryAndRequestS2(features);
        } else {
            buildQueryAndRequestL8(features);
        }

        const geojson = { "type": "FeatureCollection", "features": features};
        const extent = turf.bbox(geojson);
        const llb = mapboxgl.LngLatBounds.convert([[extent[0],extent[1]], [extent[2],extent[3]]]);
        if (map.getZoom() <= 8) map.fitBounds(llb, {padding: 50});
    }
});

map.on('load', () => {

    map.addSource('landsat', {
        "type": "vector",
        "url": "mapbox://vincentsarago.8ib6ynrs"
    });

    map.addLayer({
        'id': 'L8_Grid',
        'type': 'fill',
        'source': 'landsat',
        'source-layer': 'Landsat8_Desc_filtr2',
        'paint': {
            'fill-color': 'hsla(0, 0%, 0%, 0)',
            'fill-outline-color': {
                'base': 1,
                'stops': [
                    [0, 'hsla(207, 84%, 57%, 0.24)'],
                    [22, 'hsl(207, 84%, 57%)']
                ]
            },
            'fill-opacity': 1
        }
    });

    map.addLayer({
        "id": "L8_Highlighted",
        "type": "fill",
        "source": "landsat",
        "source-layer": "Landsat8_Desc_filtr2",
        "paint": {
            "fill-outline-color": "#1386af",
            "fill-color": "#0f6d8e",
            "fill-opacity": 0.3
        },
        "filter": ["in", "PATH", ""]
    });

    map.addLayer({
        "id": "L8_Selected",
        "type": "line",
        "source": "landsat",
        "source-layer": "Landsat8_Desc_filtr2",
        "paint": {
            "line-color": "#000",
            "line-width": 1
        },
        "filter": ["in", "PATH", ""]
    });

    map.addSource('sentinel', {
        'type': 'vector',
        'url': 'mapbox://vincentsarago.0qowxm38'
    });

    map.addLayer({
        'id': 'S2_Grid',
        'type': 'fill',
        'layout': {
            'visibility': 'none'
        },
        'source': 'sentinel',
        'source-layer': 'Sentinel2_Grid',
        'paint': {
            'fill-color': 'hsla(0, 0%, 0%, 0)',
            'fill-outline-color': {
                'base': 1,
                'stops': [
                    [0, 'hsla(207, 84%, 57%, 0.24)'],
                    [22, 'hsl(207, 84%, 57%)']
                ]
            },
            'fill-opacity': 1
        }
    });

    map.addLayer({
        'id': 'S2_Highlighted',
        'type': 'fill',
        'layout': {
            'visibility': 'none'
        },
        'source': 'sentinel',
        'source-layer': 'Sentinel2_Grid',
        'paint': {
            "fill-outline-color": "#1386af",
            "fill-color": "#0f6d8e",
            "fill-opacity": 0.3
        },
        'filter': ['in', 'Name', '']
    });

    map.addLayer({
        'id': 'S2_Selected',
        'type': 'line',
        'layout': {
            'visibility': 'none'
        },
        'source': 'sentinel',
        'source-layer': 'Sentinel2_Grid',
        "paint": {
            "line-color": "#000",
            "line-width": 1
        },
        'filter': ['in', 'Name', '']
    });
    $(".loading-map").addClass('off');

    const params = parseParams(window.location.search)
    if (params.sceneid) {

        showSiteInfo();

        let sceneid = params.sceneid;
        let scene_info;
        let date = ''
        if (/L[COTEM]08_L\d{1}[A-Z]{2}_\d{6}_\d{8}_\d{8}_\d{2}_(T1|RT)/.exec(sceneid)) {
            scene_info = parseSceneid_c1(sceneid);
            date = sceneid.split('_')[3];
            date = `${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}`;
            initSceneL8(sceneid, date);
        } else if (/L[COTEM]8\d{6}\d{7}[A-Z]{3}\d{2}/.exec(sceneid)) {
            scene_info = parseSceneid_pre(sceneid);
            sceneid = sceneid.replace(/LGN0[0-9]/, 'LGN00');
            initSceneL8(sceneid, date);
        } else if (/S2[AB]_tile_[0-9]{8}_[0-9]{2}[A-Z]{3}_[0-9]/.exec(sceneid)) {
            $(".map-top-right .toggle-group input[sat='sentinel']").prop('checked', true);
            updateSat();
            date = sceneid.split('_')[2];
            date = `${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}`;
            initSceneS2(sceneid, date);
        }

        $('#btn-clear').removeClass('none')
    }

});

console.log("You think you can find something here ?");
console.log("The project is fully open-source. Go check github.com/remotepixel/viewer.remotepixel.ca ");
