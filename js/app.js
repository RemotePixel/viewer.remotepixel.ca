"use strict";


mapboxgl.accessToken = '';
const landsat_tiler_url = '';
const sentinel_tiler_url = '';

const sat_api = 'https://api.developmentseed.org/satellites/?search=';

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

    sceneid = sceneid.replace('LGN01', 'LGN00');

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
        uz : tile.slice(0, 2),
        lb : tile.slice(2, 3),
        sq : tile.slice(3, 5)
    };
};

const s2_name_to_key = (scene) => {
    const info = scene.split('_');
    const acquisitionDate = info[2];
    const tile_info = parse_s2_tile(info[3]);
    const num = info[4];

    return [
        tile_info.uz,
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

    if (map.getSource('raster-tiles')) map.removeSource('raster-tiles');
    if (map.getLayer('raster-tiles')) map.removeLayer('raster-tiles');

    const prStr = [].concat.apply([], features.map(function(e){
        return "(path:" + e.properties.PATH.toString() + "+AND+row:" + e.properties.ROW.toString() + ")";
    })).join('+OR+');

    const query = `${sat_api}satellite_name:landsat-8+AND+(${prStr})&limit=2000`;
    const results = [];

    $.getJSON(query, (data) => {
        if (data.meta.found !== 0) {

            for (let i = 0; i < data.results.length; i += 1) {
                let scene = {};
                scene.path = data.results[i].path.toString();
                scene.row = data.results[i].row.toString();
                scene.grid = data.results[i].path + '/' + data.results[i].row;
                scene.date = data.results[i].date;
                scene.cloud = data.results[i].cloud_coverage;
                scene.browseURL = data.results[i].browseURL.replace('http://', 'https://');
                scene.thumbURL = scene.browseURL.replace('browse/', 'browse/thumbnails/')
                scene.sceneID = data.results[i].scene_id;
                scene.productID = data.results[i].LANDSAT_PRODUCT_ID;
                scene.awsID = (Date.parse(scene.date) < Date.parse('2017-05-01')) ? data.results[i].scene_id.replace(/LGN0[0-9]/, 'LGN00'): data.results[i].LANDSAT_PRODUCT_ID;
                results.push(scene);
            }

            results.sort(sortScenes);

            for (let i = 0; i < results.length; i += 1) {

                $('.list-img').append(
                    `<li data-row="${results[i].row}" data-path="${results[i].path}" data-date="${results[i].date}" data-cloud="${results[i].cloud}" class="list-element" onclick="initSceneL8('${results[i].awsID}','${results[i].date}')" onmouseover="overImage(this)" onmouseout="outImage()">` +
                        `<img class="img-item" src="${results[i].thumbURL}">` +
                    '</li>'
                );
            }

        } else {
            $('.list-img').append('<span class="nodata-error">No image found</span>');
        }
    })
    .fail(() => {
        $('.list-img').append('<span class="serv-error">Sat-API Error</span>');
    })
    .always(() => {
        $('.map').addClass('in');
        $(".metaloader").addClass('off');
        $('.list-img').removeClass('none');
        $('#btn-clear').removeClass('none');
        map.resize();
    });
};

const buildQueryAndRequestS2 = (features) => {
    $('.list-img').scrollLeft(0);
    $('.list-img').empty();

    $(".scenes-info").addClass('none');
    $('.errorMessage').addClass('none');
    $(".metaloader").removeClass('off');

    if (map.getSource('raster-tiles')) map.removeSource('raster-tiles');
    if (map.getLayer('raster-tiles')) map.removeLayer('raster-tiles');

    const prStr = [].concat.apply([], features.map(function(e){
        return "(grid_square:" +
            e.properties.Name.slice(3, 5) +
            "+AND+latitude_band:" +
            e.properties.Name.slice(2, 3) +
            "+AND+utm_zone:" +
            e.properties.Name.slice(0, 2) +
            ")";
    })).join('+OR+');

    const query = sat_api + 'satellite_name:sentinel-2+AND+(' + prStr + ")&limit=2000";
    const results = [];

    $.getJSON(query, (data) => {
        if (data.meta.found !== 0) {

            for (let i = 0; i < data.results.length; i += 1) {
                let scene = {};
                scene.date = data.results[i].date;
                scene.cloud = data.results[i].cloud_coverage;
                scene.utm_zone = data.results[i].utm_zone.toString();
                scene.grid_square = data.results[i].grid_square;
                scene.coverage = data.results[i].data_coverage_percentage;
                scene.latitude_band = data.results[i].latitude_band;
                scene.sceneID = data.results[i].scene_id;
                scene.browseURL = data.results[i].thumbnail.replace('.jp2', ".jpg");
                scene.path = data.results[i].aws_path.replace('tiles', "#tiles");
                scene.grid = scene.utm_zone + scene.latitude_band + scene.grid_square;
                results.push(scene);
            }

            results.sort(sortScenes);

            for (let i = 0; i < results.length; i += 1) {
                $('.list-img').append(
                    `<li data-grid="${results[i].grid}" data-date="${results[i].date}" data-cloud="${results[i].cloud}" class="list-element" onclick="initSceneS2('${results[i].sceneID}','${results[i].date}')" onmouseover="overImageS2(this)" onmouseout="outImageS2()">` +
                        `<img class="img-item" src="${results[i].browseURL}">` +
                    '</li>'
                );
            }

        } else {
            $('.list-img').append('<span class="nodata-error">No image found</span>');
        }
    })
    .fail(() => {
        $('.list-img').append('<span class="serv-error">Sat-API Error</span>');
    })
    .always(() => {
        $('.map').addClass('in');
        $(".metaloader").addClass('off');
        $('.list-img').removeClass('none');
        $('#btn-clear').removeClass('none');
        map.resize();
    });
};

const overImage = (element) => {
    let hoverstr = [
        'all',
        ['==', 'PATH', parseInt($(element)[0].getAttribute('data-path'))],
        ['==', 'ROW', parseInt($(element)[0].getAttribute('data-row'))]
    ];
    map.setFilter("L8_Highlighted", hoverstr);

    const sceneDate = $(element)[0].getAttribute('data-date');
    const sceneCloud = $(element)[0].getAttribute('data-cloud');
    $('.img-over-info').empty();
    $('.img-over-info').removeClass('none');
    $('.img-over-info').append(`<span>${sceneDate} | ${sceneCloud}% </span>`);
};

const outImage = () => {
    map.setFilter("L8_Highlighted", ['all', ['==', 'PATH', ''], ['==', 'ROW', '']]);
    $('.img-over-info').addClass('none');
};

const overImageS2 = (element) => {
    const grid = $(element)[0].getAttribute('data-grid');
    map.setFilter("S2_Highlighted", ['in', 'Name', grid]);

    const sceneDate = $(element)[0].getAttribute('data-date');
    const sceneCloud = $(element)[0].getAttribute('data-cloud');
    $('.img-over-info').empty();
    $('.img-over-info').removeClass('none');
    $('.img-over-info').append(`<span>${sceneDate} | ${sceneCloud}% </span>`);
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
  const query = `${landsat_tiler_url}/metadata/${sceneID}?'pmim=${min}&pmax=${max}`;

  $.getJSON(query, (data) => {
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
      $(".scenes-info .url").html('<a href=' + AWSurl + ' target="_blanck">link</a>');

      $('#dl').removeClass('none');
      $('.errorMessage').addClass('none');
  })
      .fail(() => {
          if (map.getSource('raster-tiles')) map.removeSource('raster-tiles');
          if (map.getLayer('raster-tiles')) map.removeLayer('raster-tiles');
          $('.errorMessage').removeClass('none');
          $(".scenes-info span").text('');
          $(".scenes-info").addClass('none');
      })
      .always(() => {
          $('.metaloader').addClass('off');
      });
};

const initSceneS2 = (sceneID, sceneDate) => {
  $(".metaloader").removeClass('off');
  $('.errorMessage').addClass('none');
  $('#dl').addClass('none');

  let min = $("#minCount").val();
  let max = $("#maxCount").val();
  const query = `${sentinel_tiler_url}/metadata/${sceneID}?'pmim=${min}&pmax=${max}`;

  $.getJSON(query, (data) => {
      scope.imgMetadata = data;
      updateRasterTile();

      let key = s2_name_to_key(sceneID);
      const AWSurl = `https://sentinel-s2-l1c.s3.amazonaws.com/tiles/${key}/index.html`;

      $(".scenes-info").removeClass('none');
      $(".scenes-info .id").text(sceneID);
      $(".scenes-info .date").text(sceneDate);
      $(".scenes-info .url").html('<a href=' + AWSurl + ' target="_blanck">link</a>');

      $('#dl').removeClass('none');
      $('.errorMessage').addClass('none');
  })
      .fail(() => {
          if (map.getSource('raster-tiles')) map.removeSource('raster-tiles');
          if (map.getLayer('raster-tiles')) map.removeLayer('raster-tiles');
          $('.errorMessage').removeClass('none');
          $(".scenes-info span").text('');
          $(".scenes-info").addClass('none');
      })
      .always(() => {
          $('.metaloader').addClass('off');
      });
};

const updateRasterTile = () => {
    if (map.getLayer('raster-tiles')) map.removeLayer('raster-tiles');
    if (map.getSource('raster-tiles')) map.removeSource('raster-tiles');

    const sat = $(".map-top-right .toggle-group input:checked")[0].getAttribute('sat');

    let meta = scope.imgMetadata;

    let tileURL;
    let attrib;
    let maxzoom;

    const rgb= $(`.img-display-options .toggle-group.${sat} input:checked`).attr("data");
    const bands = rgb.split(',');

    if (sat== 'sentinel') {
      tileURL = `${sentinel_tiler_url}/tiles/${meta.sceneid}/{z}/{x}/{y}.png?` +
          `rgb=${rgb}` +
          '&tile=256' +
          `&r_bds=${meta.rgbMinMax[bands[0]]}` +
          `&g_bds=${meta.rgbMinMax[bands[1]]}` +
          `&b_bds=${meta.rgbMinMax[bands[2]]}`;

      attrib = '<span> &copy; Copernicus / ESA 2017</span>';
      maxzoom = 15;
    } else {
      tileURL = `${landsat_tiler_url}/tiles/${meta.sceneid}/{z}/{x}/{y}.png?` +
          `rgb=${bands}` +
          '&tile=256' +
          `&r_bds=${meta.rgbMinMax[bands[0]]}` +
          `&g_bds=${meta.rgbMinMax[bands[1]]}` +
          `&b_bds=${meta.rgbMinMax[bands[2]]}`;
      if (rgb == '4,3,2') tileURL += '&pan=True';

      attrib = '<a href="https://landsat.usgs.gov/landsat-8"> &copy; USGS/NASA Landsat</a>';
      maxzoom = 14;
    }

    $(".scenes-info .rgb").text(rgb.toString());

    // NOTE: Calling 512x512px tiles is a bit longer but gives a
    // better quality image and reduce the number of tiles requested

    // HACK: Trade-off between quality and speed. Setting source.tileSize to 512 and telling landsat-tiler
    // to get 256x256px reduces the number of lambda calls (but they are faster)
    // and reduce the quality because MapboxGl will oversample the tile.

    map.addSource('raster-tiles', {
        type: "raster",
        tiles: [tileURL],
        attribution : [attrib],
        bounds: scope.imgMetadata.bounds,
        minzoom: 7,
        maxzoom: maxzoom,
        tileSize: 256
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

  $(".img-display-options .toggle-group input").prop('checked', false);
  $(".img-display-options .toggle-group input#default").prop('checked', true);

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


$(".img-display-options .toggle-group").change(() => {
    if (map.getSource('raster-tiles')) updateRasterTile();
});

document.getElementById("btn-clear").onclick = () => {reset();};

const button = document.getElementById('dl');
button.addEventListener('click', (e) => {
    map.getCanvas().toBlob(function(blob) {
        const sat = $(".map-top-right .toggle-group input:checked")[0].getAttribute('sat');
        let bands = $(`.img-display-options .toggle-group.${sat} input:checked`).attr("data");
        bands = bands.replace(/,/g, '');
        const imgName = `${scope.imgMetadata.sceneid}_${bands}.png`
        saveAs(blob, imgName);
    });
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
  } else {
      ['S2_Grid', 'S2_Highlighted', 'S2_Selected'].forEach(function (e) {
          map.setLayoutProperty(e, 'visibility', 'none');
      });
      ['L8_Grid', 'L8_Highlighted', 'L8_Selected'].forEach(function (e) {
          map.setLayoutProperty(e, 'visibility', 'visible');
      });
  }

  $(".img-display-options .toggle-group").toggleClass('none');
  $(`.img-display-options .toggle-group input#default`).prop('checked', true);
};

const toggle = document.getElementById('satellite-toggle');
toggle.addEventListener('change', updateSat);


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
