"use strict";

mapboxgl.accessToken = '';

const landsat_services = '';
const sentinel_services = '';
const cbers_services  = '';

const access_token = '';

let scope = {};
const config = {
  tile: 256,
  access_token: access_token
};

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
  return moment(b.date, 'YYYYMMDD') - moment(a.date, 'YYYYMMDD');
};

const parseSceneid_c1 = (sceneid) => {
  const sceneid_info = sceneid.split('_');
  return {
    satellite: sceneid_info[0].slice(0,1) + sceneid_info[0].slice(3),
    sensor: sceneid_info[0].slice(1,2),
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
    sensor: sceneid.slice(1,2),
    satellite: sceneid.slice(2,3),
    path: sceneid.slice(3,6),
    row: sceneid.slice(6,9),
    acquisitionYear: sceneid.slice(9,13),
    acquisitionJulianDay: sceneid.slice(13,16),
    acquisition_date: moment().utc().year(sceneid.slice(9,13)).dayOfYear(sceneid.slice(13,16)).format('YYYYMMDD'),
    groundStationIdentifier: sceneid.slice(16,19),
    archiveVersion: sceneid.slice(19,21)
  };
};

const parseCBERSid = (sceneid) => {
  return {
    scene_id: sceneid,
    satellite: sceneid.split('_')[0],
    version: sceneid.split('_')[1],
    sensor: sceneid.split('_')[2],
    path: sceneid.split('_')[4],
    row: sceneid.split('_')[5],
    acquisition_date: sceneid.split('_')[3],
    processing_level: sceneid.split('_')[6]
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

  return [
    tile_info.uz.replace(/^0/, ''),
    tile_info.lb,
    tile_info.sq,
    acquisitionDate.slice(0,4),
    acquisitionDate.slice(4,6).replace(/^0+/, ''),
    acquisitionDate.slice(6,8).replace(/^0+/, ''),
    info[4]
  ].join('/');
};


const buildQueryAndRequestL8 = (features) => {
  $('.list-img').scrollLeft(0);
  $('.list-img').empty();

  $(".scenes-info").addClass('none');
  $('.errorMessage').addClass('none');
  $(".metaloader").removeClass('off');
  $('#nodata-error').addClass('none');

  if (map.getLayer('raster-tiles')) map.removeLayer('raster-tiles');
  if (map.getSource('raster-tiles')) map.removeSource('raster-tiles');

  let res = {};

  Promise.all(features.map(e => {
    const row = zeroPad(e.properties.ROW, 3);
    const path = zeroPad(e.properties.PATH, 3);
    const query = `${landsat_services}/search?row=${row}&path=${path}&full=true`;

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
        scene.date = data[i].acquisition_date;
        scene.cloud = data[i].cloud_coverage;
        scene.browseURL = data[i].browseURL;
        scene.thumbURL = data[i].thumbURL;
        scene.scene_id = data[i].scene_id;
        scene.type = data[i].category;
        res[scene.scene_id] = scene;
      }

      let ids = Object.keys(res);
      for (let i = 0; i < ids.length; i += 1) {
        if (/^L[COTEM]08_.+RT$/.exec(ids[i])) {
          let id = ids[i].split('_').slice(0,4).join('_')
          let pattern = new RegExp(`^${id}`);
          let same = ids.filter(e => {return pattern.test(e);});
          if (same.length > 1) delete res[ids[i]];
        }
      }

      const results = []
      for (let key in res) {
        results.push(res[key]);
      }
      results.sort(sortScenes);

      for (let i = 0; i < results.length; i += 1) {
        $('.list-img').append(
          `<li data-row="${results[i].row}" data-path="${results[i].path}" data-type="${results[i].type}" data-date="${results[i].date}" data-cloud="${results[i].cloud}" class="list-element" onclick="initSceneL8('${results[i].scene_id}','${results[i].date}')" onmouseover="overImageL8(this)" onmouseout="outImage()">` +
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

  if (map.getLayer('raster-tiles')) map.removeLayer('raster-tiles');
  if (map.getSource('raster-tiles')) map.removeSource('raster-tiles');

  const results = [];

  Promise.all(features.map(e => {
    const utm = e.properties.Name.slice(0, 2);
    const lat = e.properties.Name.slice(2, 3);
    const grid = e.properties.Name.slice(3, 5);

    const level = 'l1c';
    const query = `${sentinel_services}/s2/search?utm=${utm}&grid=${grid}&lat=${lat}&full=true&level=${level}`;

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
        scene.date = data[i].acquisition_date
        scene.cloud = data[i].cloud_coverage;
        scene.coverage = data[i].coverage;
        scene.browseURL = data[i].browseURL;
        scene.scene_id = data[i].scene_id;
        scene.tile = data[i].scene_id.split('_')[3];
        scene.sat = scene.scene_id.slice(0,3);
        if (scene.coverage >= 5.0) results.push(scene);
      }
      results.sort(sortScenes);

      for (let i = 0; i < results.length; i += 1) {
        $('.list-img').append(
          `<li data-tile="${results[i].tile}" data-sat="${results[i].sat}" data-cloud="${results[i].cloud}" data-date="${results[i].date}" class="list-element" onclick="initSceneS2('${results[i].scene_id}','${results[i].date}')" onmouseover="overImageS2(this)" onmouseout="outImage()">` +
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


const buildQueryAndRequestCBERS = (features) => {
  $('.list-img').scrollLeft(0);
  $('.list-img').empty();

  $(".scenes-info").addClass('none');
  $('.errorMessage').addClass('none');
  $(".metaloader").removeClass('off');
  $('#nodata-error').addClass('none');

  if (map.getLayer('raster-tiles')) map.removeLayer('raster-tiles');
  if (map.getSource('raster-tiles')) map.removeSource('raster-tiles');

  const results = [];

  Promise.all(features.map(e => {
    const row = zeroPad(e.properties.ROW, 3);
    const path = zeroPad(e.properties.PATH, 3);
    const query = `${cbers_services}/search?row=${row}&path=${path}`;

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
        scene.date = data[i].acquisition_date;
        scene.thumbURL = data[i].thumbURL;
        scene.scene_id = data[i].scene_id;
        scene.type = data[i].processing_level;
        results.push(scene);
      }
      results.sort(sortScenes);

      for (let i = 0; i < results.length; i += 1) {
        $('.list-img').append(
          `<li data-row="${results[i].row}" data-path="${results[i].path}" data-type="${results[i].type}" data-date="${results[i].date}" class="list-element" onclick="initSceneCBERS('${results[i].scene_id}','${results[i].date}')" onmouseover="overImageCBERS(this)" onmouseout="outImage()">` +
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

const overImageL8 = (element) => {
  let hoverstr = [
    'all',
    ['==', 'PATH', parseInt($(element)[0].getAttribute('data-path'))],
    ['==', 'ROW', parseInt($(element)[0].getAttribute('data-row'))]
  ];
  map.setFilter("Highlighted", hoverstr);

  const sceneType = $(element)[0].getAttribute('data-type');
  const sceneDate = $(element)[0].getAttribute('data-date');
  const sceneCloud = $(element)[0].getAttribute('data-cloud');
  $('.img-over-info').empty();
  $('.img-over-info').removeClass('none');
  $('.img-over-info').append(`<span>${sceneType} | ${sceneDate} | ${sceneCloud}% </span>`);
};

const overImageS2 = (element) => {
  const tile = $(element)[0].getAttribute('data-tile');
  map.setFilter("Highlighted", ['in', 'Name', tile]);

  const sceneSat = $(element)[0].getAttribute('data-sat');
  const sceneDate = $(element)[0].getAttribute('data-date');
  const sceneCloud = $(element)[0].getAttribute('data-cloud');
  $('.img-over-info').empty();
  $('.img-over-info').removeClass('none');
  $('.img-over-info').append(`<span>${sceneSat} | ${sceneDate} | ${sceneCloud}% </span>`);
};

const overImageCBERS = (element) => {
  let hoverstr = [
    'all',
    ['==', 'PATH', parseInt($(element)[0].getAttribute('data-path'))],
    ['==', 'ROW', parseInt($(element)[0].getAttribute('data-row'))]
  ];
  map.setFilter("Highlighted", hoverstr);

  const sceneType = $(element)[0].getAttribute('data-type');
  const sceneDate = $(element)[0].getAttribute('data-date');
  $('.img-over-info').empty();
  $('.img-over-info').removeClass('none');
  $('.img-over-info').append(`<span>${sceneType} | ${sceneDate}</span>`);
};

const outImage = () => {
  map.setFilter("Highlighted", ['any', ["in", "Name", ""], ["in", "PATH", ""]]);
  $('.img-over-info').addClass('none');
};

const initSceneL8 = (sceneID, sceneDate) => {
  $(".metaloader").removeClass('off');
  $('.errorMessage').addClass('none');
  $('#dl').addClass('none');

  let min = $("#minCount").val();
  let max = $("#maxCount").val();
  const query = `${landsat_services}/metadata/${sceneID}?'pmim=${min}&pmax=${max}&access_token=${config.access_token}`;

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
      if (map.getLayer('raster-tiles')) map.removeLayer('raster-tiles');
      if (map.getSource('raster-tiles')) map.removeSource('raster-tiles');
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
  const query = `${sentinel_services}/s2/metadata/${sceneID}?'pmim=${min}&pmax=${max}&access_token=${config.access_token}`;

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
      if (map.getLayer('raster-tiles')) map.removeLayer('raster-tiles');
      if (map.getSource('raster-tiles')) map.removeSource('raster-tiles');
      $('.errorMessage').removeClass('none');
      $(".scenes-info span").text('');
      $(".scenes-info").addClass('none');
    })
    .then(() => {
      $('.metaloader').addClass('off');
    });
};


const initSceneCBERS = (sceneID, sceneDate) => {
  $(".metaloader").removeClass('off');
  $('.errorMessage').addClass('none');
  $('#dl').addClass('none');

  let min = $("#minCount").val();
  let max = $("#maxCount").val();
  const query = `${cbers_services}/metadata/${sceneID}?'pmim=${min}&pmax=${max}&access_token=${config.access_token}`;

  $.getJSON(query).done()
    .then(data => {
      scope.imgMetadata = data;
      updateRasterTile();

      const AWSurl = 'https://cbers-pds.s3.amazonaws.com/index.html';
      $(".scenes-info").removeClass('none');
      $(".scenes-info .id").text(sceneID);
      $(".scenes-info .date").text(sceneDate);
      $(".scenes-info .url").html(`<a href=${AWSurl} target="_blanck">link</a>`);
      $('.errorMessage').addClass('none');
    })
    .catch(err => {
      console.warn(err);
      if (map.getLayer('raster-tiles')) map.removeLayer('raster-tiles');
      if (map.getSource('raster-tiles')) map.removeSource('raster-tiles');
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
  $('#btn-text').addClass('none');
  $('#dl').addClass('none');

  const sat = $(".map-top-right .toggle-group input:checked")[0].getAttribute('sat');
  const meta = scope.imgMetadata;
  let attrib;
  let maxzoom;
  let rgb;
  let histo_cuts;
  let endpoint;
  let url;

  switch(sat) {
    case 'landsat':
      endpoint = landsat_services;
      attrib = '<a href="https://landsat.usgs.gov/landsat-8"> &copy; USGS/NASA Landsat</a>';
      maxzoom = 14;
      break;
    case 'sentinel':
      endpoint = `${sentinel_services}/s2`;
      attrib = '<span> &copy; Copernicus / ESA 2017</span>';
      maxzoom = 15;
      break;
    case 'cbers':
      endpoint = cbers_services;
      attrib = '<a href=""> &copy; CBERS</a>';
      maxzoom = 15;
      break;
    default:
      throw new Error(`Invalid ${source_id}`);
  }

  let params = {
    'tile': config.tile,
    'access_token': config.access_token
  };

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
    tileSize: 512
  });

  map.addLayer({
    'id': 'raster-tiles',
    'type': 'raster',
    'source': 'raster-tiles'
  });

  map.getLayer('raster-tiles').top = false;

  $('#btn-text').removeClass('none');
  $('#dl').removeClass('none');

  const extent = scope.imgMetadata.bounds;
  const llb = mapboxgl.LngLatBounds.convert([[extent[0],extent[1]], [extent[2],extent[3]]]);
  if (map.getZoom() <= 6) map.fitBounds(llb, {padding: 50});

  let historyParams = {
    sceneid: meta.sceneid,
    pmin: $("#minCount").val(),
    pmax: $("#maxCount").val()
  }
  if (params.rgb) historyParams.rgb = params.rgb;
  if (params.ratio) historyParams.ratio = params.ratio;
  if (params.tile) historyParams.tile = params.tile;
  updateHistory(historyParams);
};

const updateMetadata = () => {
  if (!map.getSource('raster-tiles')) return;
  const sat = $(".map-top-right .toggle-group input:checked")[0].getAttribute('sat');
  switch(sat) {
    case 'landsat':
      initSceneL8(scope.imgMetadata.sceneid, scope.imgMetadata.date);
      break;
    case 'sentinel':
      initSceneS2(scope.imgMetadata.sceneid, scope.imgMetadata.date);
      break;
    case 'cbers':
      initSceneCBERS(scope.imgMetadata.sceneid, scope.imgMetadata.date);
      break;
    default:
      throw new Error(`Invalid ${source_id}`);
  }
};


const reset = () => {
  if (map.getLayer('raster-tiles')) map.removeLayer('raster-tiles');
  if (map.getSource('raster-tiles')) map.removeSource('raster-tiles');

  map.setFilter("Highlighted", ['any', ["in", "Name", ""], ["in", "PATH", ""]]);
  map.setFilter("Selected", ['any', ["in", "Name", ""], ["in", "PATH", ""]]);

  $('.list-img').scrollLeft(0);
  $('.list-img').empty();

  $(".metaloader").addClass('off');
  $(".scenes-info span").text('');
  $(".scenes-info").addClass('none');
  $('#btn-clear').addClass('none');
  $('#btn-text').addClass('none')
  $('#dl').addClass('none');

  scope = {};

  $("#minCount").val(2);
  $("#maxCount").val(98);

  $('.map').removeClass('in');
  $('.list-img').addClass('none');
  map.resize();

  $('.errorMessage').addClass('none');
  updateHistory({});
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

document.getElementById("btn-text").onclick = () => {
  if (!map.getLayer('raster-tiles')) return;

  if (map.getLayer('raster-tiles').top === true) {
    map.moveLayer('raster-tiles');
    map.getLayer('raster-tiles').top = false;
  } else {
    map.moveLayer('raster-tiles', 'airport-label');
    map.getLayer('raster-tiles').top = true;
  }
};


document.getElementById('dl').addEventListener('click', () => {
  map.getCanvas().toBlob(function(blob) {
    const imgName = `${scope.imgMetadata.sceneid}.png`
    saveAs(blob, imgName);
  });
});

document.getElementById('btn-hide').addEventListener('click', () => {
  $('#left').toggleClass('off');
  $('#menu').toggleClass('off');
});

const showSiteInfo = () => {
  $('.site-info').toggleClass('in');
  map.resize();
};

const getFeatures = (e) => {

  const sat = $(".map-top-right .toggle-group input:checked")[0].getAttribute('sat');
  let pr;

  let features = map.queryRenderedFeatures(e.point, {layers: ['Grid']});

  if (sat == 'sentinel') {
    pr = ["==", "Name", ""];
    if (features.length !== 0) {
      pr = [].concat.apply([], ['any', features.map(e => {
        return ["==", "Name", e.properties.Name];
      })]);
    }
  } else {
    pr = ["in", "PATH", ""];
    if (features.length !== 0) {
      pr =  [].concat.apply([], ['any', features.map(e => {
        return ["all", ["==", "PATH", e.properties.PATH], ["==", "ROW", e.properties.ROW]];
      })]);
    }
  }

  map.setFilter("Highlighted", pr);
  return features;
};


const updateSat = () => {
  reset();
  const sat = $(".map-top-right .toggle-group input:checked")[0].getAttribute('sat');
  switch(sat) {
    case 'landsat':
      landsatUI();
      break;
    case 'sentinel':
      sentinelUI();
      break;
    case 'cbers':
      cbersUI();
      break;
    default:
      throw new Error(`Invalid ${source_id}`);
  }
  addLayers(sat);
};

const updateRGB = (rgb) => {
  rgb = rgb.split(',');
  if (rgb.length === 1) {
    updateBands($(`#band-buttons [value="${rgb[0]}"]`));
    switchPane({id: 'band'});
  } else {
    document.getElementById('r').value = rgb[0];
    document.getElementById('g').value = rgb[1];
    document.getElementById('b').value = rgb[2];
    $('#rgb-selection').val("custom").change();
    $('#rgb-buttons select').prop('disabled', false);
    switchPane({id: 'rgb'});
  }
};

const updateRatio = (ratio) => {
  $('#ratio-selection').val(ratio).change();
  switchPane({id: 'process'});
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


const cbersUI = () => {
  $('#rgb-selection').empty();
  $('#rgb-selection').append(
    '<option value="7,6,5">Natural Color (7,6,5)</option>' +
    '<option value="8,7,6">Color Infrared Vegetation (8,7,6)</option>' +
    '<option value="custom">Custom</option>');

  ['r', 'g', 'b'].forEach(e => {
    $(`#${e}`).empty();
    $(`#${e}`).append(
      '<option value="5">05</option>' +
      '<option value="6">06</option>' +
      '<option value="7">07</option>' +
      '<option value="8">08</option>');
  });

  $('#r option[value="7"]').attr('selected', 'selected');
  $('#g option[value="6"]').attr('selected', 'selected');
  $('#b option[value="5"]').attr('selected', 'selected');

  $('#band-buttons').empty();
  $('#band-buttons').append(
    '<button onclick="updateBands(this)" value="5" class="btn btn--stroke btn--stroke--2 mx6 my6 txt-m active">5</button>' +
    '<button onclick="updateBands(this)" value="6" class="btn btn--stroke btn--stroke--2 mx6 my6 txt-m">6</button>' +
    '<button onclick="updateBands(this)" value="7" class="btn btn--stroke btn--stroke--2 mx6 my6 txt-m">7</button>' +
    '<button onclick="updateBands(this)" value="8" class="btn btn--stroke btn--stroke--2 mx6 my6 txt-m">8</button>');

    $('#ratio-selection').empty();
    $('#ratio-selection').append('<option value="ndvi">NDVI</option>');
};

document.getElementById('satellite-toggle').addEventListener('change', updateSat);

const updateHistory = (params) => {
  const url_params = Object.keys(params).map(i => `${i}=${params[i]}`).join('&');
  const newUrl = `${window.location.origin}/?${url_params}${window.location.hash}`;
  window.history.replaceState({} , '', newUrl);
  return;
};

var map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/satellite-streets-v9',
  center: [-70.50, 40],
  zoom: 3,
  attributionControl: true,
  preserveDrawingBuffer: true,
  hash: true,
  minZoom: 3,
  maxZoom: 15
});

map.addControl(new mapboxgl.NavigationControl(), 'top-right');

map.on('mousemove', (e) => {getFeatures(e);});

map.on('click', (e) => {
  $('.errorMessage').addClass('none');
  const features = getFeatures(e);
  if (features.length !== 0) {
    let pr;
    const sat = $(".map-top-right .toggle-group input:checked")[0].getAttribute('sat');
    switch(sat) {
      case 'landsat':
        pr = [].concat.apply([], ['any', features.map(e => {
          return ["all", ["==", "PATH", e.properties.PATH], ["==", "ROW", e.properties.ROW]];
        })]);
        map.setFilter("Selected", pr);
        buildQueryAndRequestL8(features);
        break;
      case 'sentinel':
        pr = [].concat.apply([], ['any', features.map(e => {
          return ["==", "Name", e.properties.Name];
        })]);
        map.setFilter("Selected", pr);
        buildQueryAndRequestS2(features);
        break;
      case 'cbers':
        pr =  [].concat.apply([], ['any', features.map(e => {
          return ["all", ["==", "PATH", e.properties.PATH], ["==", "ROW", e.properties.ROW]];
        })]);
        map.setFilter("Selected", pr);
        buildQueryAndRequestCBERS(features);
        break;
      default:
        throw new Error(`Invalid ${sat}`);
    }
    const geojson = { "type": "FeatureCollection", "features": features};
    const extent = turf.bbox(geojson);
    const llb = mapboxgl.LngLatBounds.convert([[extent[0],extent[1]], [extent[2],extent[3]]]);
    if (map.getZoom() <= 3) map.fitBounds(llb, {padding: 200});
  }
});


const addLayers = (source_id) => {
  if (map.getLayer('Grid')) map.removeLayer('Grid');
  if (map.getLayer('Highlighted')) map.removeLayer('Highlighted');
  if (map.getLayer('Selected')) map.removeLayer('Selected');

  let source_layer;
  switch(source_id) {
    case 'landsat':
      source_layer = 'Landsat8_Desc_filtr2';
      break;
    case 'sentinel':
      source_layer = 'Sentinel2_Grid'
      break;
    case 'cbers':
      source_layer = 'cbers_grid-41mvmk'
      break;
    default:
      throw new Error(`Invalid ${source_id}`);
  }

  map.addLayer({
      'id': 'Grid',
      'type': 'fill',
      'source': source_id,
      'source-layer': source_layer,
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
  }, 'admin-2-boundaries-bg');

  map.addLayer({
      'id': 'Highlighted',
      'type': 'fill',
      'source': source_id,
      'source-layer': source_layer,
      'paint': {
          'fill-outline-color': '#1386af',
          'fill-color': '#0f6d8e',
          'fill-opacity': 0.3
      },
      'filter': ['in', 'PATH', '']
  }, 'admin-2-boundaries-bg');

  map.addLayer({
      'id': 'Selected',
      'type': 'line',
      'source': source_id,
      'source-layer': source_layer,
      'paint': {
          'line-color': '#4c67da',
          'line-width': 3
      },
      'filter': ['in', 'PATH', '']
  }, 'admin-2-boundaries-bg');
}

map.on('load', () => {
  map.addSource('landsat', {
    'type': 'vector',
    'url': 'mapbox://vincentsarago.8ib6ynrs'
  });
  map.addSource('sentinel', {
    'type': 'vector',
    'url': 'mapbox://vincentsarago.0qowxm38'
  });
  map.addSource('cbers', {
    'type': 'vector',
    'url': 'mapbox://vincentsarago.3a75bnx8'
  });
  addLayers('landsat');
  $('.loading-map').addClass('off');

  const params = parseParams(window.location.search)
  if (params.tile) config.tile = params.tile;
  if (params.pmin) $("#minCount").val(params.pmin);
  if (params.pmax) $("#maxCount").val(params.pmax);

  if (params.sceneid) {
    showSiteInfo();
    let sceneid = params.sceneid;
    let scene_info;
    let date = ''
    if (/^L[COTEM]08_/.exec(sceneid)) {
        if (params.rgb) updateRGB(params.rgb);
        if (params.ratio) updateRatio(params.ratio);
        scene_info = parseSceneid_c1(sceneid);
        date = sceneid.split('_')[3];
        initSceneL8(sceneid, date);
    } else if (/^L[COTEM]8/.exec(sceneid)) {
        if (params.rgb) updateRGB(params.rgb);
        if (params.ratio) updateRatio(params.ratio);
        scene_info = parseSceneid_pre(sceneid);
        initSceneL8(sceneid, date);
    } else if (/^S2/.exec(sceneid)) {
        $(".map-top-right .toggle-group input[sat='sentinel']").prop('checked', true);
        updateSat();
        if (params.rgb) updateRGB(params.rgb);
        if (params.ratio) updateRatio(params.ratio);
        date = sceneid.split('_')[2];
        initSceneS2(sceneid, date);
    } else if  (/^CBERS/.exec(sceneid)) {
      $(".map-top-right .toggle-group input[sat='cbers']").prop('checked', true);
      updateSat();
      if (params.rgb) updateRGB(params.rgb);
      if (params.ratio) updateRatio(params.ratio);
      scene_info = parseCBERSid(sceneid);
      initSceneCBERS(sceneid, scene_info.acquisition_date);
    } else {
      console.warn(`Invalid Sceneid: ${sceneid}`)
    }
    $('#btn-clear').removeClass('none')
  }
});

console.log("You think you can find something here ?");
console.log("The project is fully open-source. Go check github.com/remotepixel/viewer.remotepixel.ca ");
