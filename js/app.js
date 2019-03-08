/* global  $, mapboxgl, moment, turf, saveAs */

mapboxgl.accessToken = 'pk.eyJ1IjoidmluY2VudHNhcmFnbyIsImEiOiJjamxwa3c1Zm0wamt3M3BwYnM2bnh2cGYyIn0.iEW0fj8Pxq_GMnmdUNa6xw'

const landsatServices = ''
const cbersServices = ''
const accessToken = ''

const satSearchApi = 'https://sat-api.developmentseed.org/stac/search'

const scope = {
  tileConfig: {
    saturation: 0,
    contrast: 0,
    opacity: 1
  },
  tileOps: {},
  tileFormat: 'png',
  tileScale: 1
}

// From Libra by developmentseed (https://github.com/developmentseed/libra)
const zeroPad = (n, c) => {
  let s = String(n)
  if (s.length < c) s = zeroPad('0' + n, c)
  return s
}

const parseParams = (wLoc) => {
  const paramList = wLoc.replace('?', '').split('&')
  const outParams = {}
  for (let i = 0; i < paramList.length; i++) {
    let tPar = paramList[i].split('=')
    outParams[tPar[0]] = tPar[1]
  }
  return outParams
}

const sortScenes = (a, b) => {
  return moment(b.date, 'YYYYMMDD') - moment(a.date, 'YYYYMMDD')
}

const parseSceneidC1 = (sceneid) => {
  const sceneInfo = sceneid.split('_')
  return {
    satellite: sceneInfo[0].slice(0, 1) + sceneInfo[0].slice(3),
    sensor: sceneInfo[0].slice(1, 2),
    correction_level: sceneInfo[1],
    path: sceneInfo[2].slice(0, 3),
    row: sceneInfo[2].slice(3),
    acquisition_date: sceneInfo[3],
    ingestion_date: sceneInfo[4],
    collection: sceneInfo[5],
    category: sceneInfo[6]
  }
}

const parseSceneidPre = (sceneid) => {
  return {
    sensor: sceneid.slice(1, 2),
    satellite: sceneid.slice(2, 3),
    path: sceneid.slice(3, 6),
    row: sceneid.slice(6, 9),
    acquisitionYear: sceneid.slice(9, 13),
    acquisitionJulianDay: sceneid.slice(13, 16),
    acquisition_date: moment().utc().year(sceneid.slice(9, 13)).dayOfYear(sceneid.slice(13, 16)).format('YYYYMMDD'),
    groundStationIdentifier: sceneid.slice(16, 19),
    archiveVersion: sceneid.slice(19, 21)
  }
}

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
  }
}

const buildQueryAndRequestL8 = (features) => {
  $('.list-img').scrollLeft(0)
  $('.list-img').empty()

  $('.scenes-info').addClass('none')
  $('.errorMessage').addClass('none')
  $('.metaloader').removeClass('off')
  $('#nodata-error').addClass('none')

  if (map.getLayer('raster-tiles')) map.removeLayer('raster-tiles')
  if (map.getSource('raster-tiles')) map.removeSource('raster-tiles')

  const results = []
  Promise.all(features.map(e => {
    const row = zeroPad(e.properties.ROW, 3)
    const path = zeroPad(e.properties.PATH, 3)

    const queryParameters = {
      limit: 1000,
      query: {
        'collection': { 'eq': 'landsat-8-l1' },
        'eo:row': { 'eq': row },
        'eo:column': { 'eq': path },
        'eo:sun_elevation': { 'gte': 0 }
      },
      fields: {
        'geometry': false,
        'include': [
          [
            'eo:column',
            'eo:row',
            'datetime',
            'eo:cloud_cover',
            'landsat:product_id',
            'landsat:tier'
          ]
        ]
      }
    }

    return $.ajax({
      url: satSearchApi,
      type: 'POST',
      data: JSON.stringify(queryParameters),
      dataType: 'json',
      contentType: 'application/json'
    }).then(data => {
      if (data.meta.found === 0) throw new Error('No image found in sat-api')
      return data.features
    }).catch(err => {
      console.warn(err)
      return []
    })
  }))
    .then(data => {
      data = [].concat.apply([], data)

      if (data.length === 0) throw new Error('No image found in sat-api')
      for (let i = 0; i < data.length; i += 1) {
        let scene = {}
        scene.path = data[i].properties['eo:column']
        scene.row = data[i].properties['eo:row']
        scene.date = data[i].properties.datetime.slice(0, 10).replace(/-/g, '')
        scene.cloud = data[i].properties['eo:cloud_cover']
        scene.browseURL = data[i].assets.thumbnail.href
        scene.thumbURL = scene.browseURL.replace('thumb_large', 'thumb_small')
        scene.scene_id = data[i].properties['landsat:product_id']
        scene.type = data[i].properties['landsat:tier']
        results.push(scene)
      }

      results.sort(sortScenes)

      for (let i = 0; i < results.length; i += 1) {
        $('.list-img').append(
          `<li data-row="${results[i].row}" data-path="${results[i].path}" data-type="${results[i].type}" data-date="${results[i].date}" data-cloud="${results[i].cloud}" class="list-element" onclick="initSceneL8('${results[i].scene_id}','${results[i].date}')" onmouseover="overImageL8(this)" onmouseout="outImage()">` +
            `<img class="img-item" src="${results[i].thumbURL}">` +
          '</li>'
        )
      }

      $('.map').addClass('in')
      $('.list-img').removeClass('none')
      $('#btn-clear').removeClass('none')
      map.resize()
    })
    .catch(err => {
      console.warn(err)
      $('#nodata-error').removeClass('none')
    })
    .then(() => {
      $('.metaloader').addClass('off')
    })
}

const buildQueryAndRequestCBERS = (features) => {
  $('.list-img').scrollLeft(0)
  $('.list-img').empty()

  $('.scenes-info').addClass('none')
  $('.errorMessage').addClass('none')
  $('.metaloader').removeClass('off')
  $('#nodata-error').addClass('none')

  if (map.getLayer('raster-tiles')) map.removeLayer('raster-tiles')
  if (map.getSource('raster-tiles')) map.removeSource('raster-tiles')

  const results = []

  Promise.all(features.map(e => {
    const row = zeroPad(e.properties.ROW, 3)
    const path = zeroPad(e.properties.PATH, 3)
    const query = `${cbersServices}/search/${path}/${row}?access_token=${accessToken}`

    return $.getJSON(query).done()
      .then(data => {
        if (data.meta.found === 0) throw new Error('No image found in sat-api')
        return data.results
      })
      .catch(err => {
        console.warn(err)
        return []
      })
  }))
    .then(data => {
      data = [].concat.apply([], data)
      if (data.length === 0) throw new Error('No image found in sat-api')
      for (let i = 0; i < data.length; i += 1) {
        let scene = {}
        scene.path = data[i].path
        scene.row = data[i].row
        scene.date = data[i].acquisition_date
        scene.thumbURL = data[i].thumbURL
        scene.scene_id = data[i].scene_id
        scene.type = data[i].processing_level
        results.push(scene)
      }
      results.sort(sortScenes)

      for (let i = 0; i < results.length; i += 1) {
        $('.list-img').append(
          `<li data-row="${results[i].row}" data-path="${results[i].path}" data-type="${results[i].type}" data-date="${results[i].date}" class="list-element" onclick="initSceneCBERS('${results[i].scene_id}','${results[i].date}')" onmouseover="overImageCBERS(this)" onmouseout="outImage()">` +
            `<img class="img-item" src="${results[i].thumbURL}">` +
          '</li>'
        )
      }

      $('.map').addClass('in')
      $('.list-img').removeClass('none')
      $('#btn-clear').removeClass('none')
      map.resize()
    })
    .catch(err => {
      console.warn(err)
      $('#nodata-error').removeClass('none')
    })
    .then(() => {
      $('.metaloader').addClass('off')
    })
}

const overImageL8 = (element) => {
  let hoverstr = [
    'all',
    ['==', 'PATH', parseInt($(element)[0].getAttribute('data-path'))],
    ['==', 'ROW', parseInt($(element)[0].getAttribute('data-row'))]
  ]
  map.setFilter('Highlighted', hoverstr)

  const sceneType = $(element)[0].getAttribute('data-type')
  const sceneDate = $(element)[0].getAttribute('data-date')
  const sceneCloud = $(element)[0].getAttribute('data-cloud')
  $('.img-over-info').empty()
  $('.img-over-info').removeClass('none')
  $('.img-over-info').append(`<span>${sceneType} | ${sceneDate} | ${sceneCloud}% </span>`)
}

const overImageCBERS = (element) => {
  let hoverstr = [
    'all',
    ['==', 'PATH', parseInt($(element)[0].getAttribute('data-path'))],
    ['==', 'ROW', parseInt($(element)[0].getAttribute('data-row'))]
  ]
  map.setFilter('Highlighted', hoverstr)

  const sceneType = $(element)[0].getAttribute('data-type')
  const sceneDate = $(element)[0].getAttribute('data-date')
  $('.img-over-info').empty()
  $('.img-over-info').removeClass('none')
  $('.img-over-info').append(`<span>${sceneType} | ${sceneDate}</span>`)
}

const outImage = () => {
  map.setFilter('Highlighted', ['any', ['in', 'Name', ''], ['in', 'PATH', '']])
  $('.img-over-info').addClass('none')
}

const initSceneL8 = (sceneID, sceneDate) => {
  $('.metaloader').removeClass('off')
  $('.errorMessage').addClass('none')
  $('#dl').addClass('none')

  const query = `${landsatServices}/bounds/${sceneID}?access_token=${accessToken}`

  $.getJSON(query).done()
    .then(data => {
      scope.imgMetadata = data
      updateRasterTile()

      const sceneInfo = parseSceneidC1(sceneID)
      const AWSurl = `https://landsatonaws.com/L8/${sceneInfo.path}/${sceneInfo.row}/${sceneID}`

      $('.scenes-info').removeClass('none')
      $('.scenes-info .id').text(sceneID)
      $('.scenes-info .date').text(sceneDate)
      $('.scenes-info .url').html(`<a href=${AWSurl} target='_blanck'>link</a>`)

      $('#dl').removeClass('none')
      $('.errorMessage').addClass('none')
    })
    .catch(err => {
      console.warn(err)
      if (map.getLayer('raster-tiles')) map.removeLayer('raster-tiles')
      if (map.getSource('raster-tiles')) map.removeSource('raster-tiles')
      $('.errorMessage').removeClass('none')
      $('.scenes-info span').text('')
      $('.scenes-info').addClass('none')
    })
    .then(() => {
      $('.metaloader').addClass('off')
    })
}

const initSceneCBERS = (sceneID, sceneDate) => {
  $('.metaloader').removeClass('off')
  $('.errorMessage').addClass('none')
  $('#dl').addClass('none')

  const query = `${cbersServices}/bounds/${sceneID}?&access_token=${accessToken}`

  $.getJSON(query).done()
    .then(data => {
      scope.imgMetadata = data
      updateRasterTile()

      const AWSurl = 'https://cbers-pds.s3.amazonaws.com/index.html'
      $('.scenes-info').removeClass('none')
      $('.scenes-info .id').text(sceneID)
      $('.scenes-info .date').text(sceneDate)
      $('.scenes-info .url').html(`<a href=${AWSurl} target='_blanck'>link</a>`)
      $('.errorMessage').addClass('none')
    })
    .catch(err => {
      console.warn(err)
      if (map.getLayer('raster-tiles')) map.removeLayer('raster-tiles')
      if (map.getSource('raster-tiles')) map.removeSource('raster-tiles')
      $('.errorMessage').removeClass('none')
      $('.scenes-info span').text('')
      $('.scenes-info').addClass('none')
    })
    .then(() => {
      $('.metaloader').addClass('off')
    })
}

const updateRasterTile = () => {
  if (map.getLayer('raster-tiles')) map.removeLayer('raster-tiles')
  if (map.getSource('raster-tiles')) map.removeSource('raster-tiles')
  $('#btn-text').addClass('none')
  $('#dl').addClass('none')

  const sat = $('.map-top-right .toggle-group input:checked')[0].getAttribute('sat')

  const meta = scope.imgMetadata
  const tileSize = 256 * scope.tileScale
  const tileFormat = scope.tileFormat

  let attribution, minZoom, maxZoom, endpoint, url

  switch (sat) {
    case 'landsat':
      endpoint = landsatServices
      attribution = '<a href="https://landsat.usgs.gov/landsat-8"> &copy; USGS/NASA Landsat</a>'
      minZoom = 8
      maxZoom = 13
      break

    case 'cbers':
      endpoint = cbersServices
      attribution = '<a href=""> &copy; CBERS</a>'
      minZoom = 8
      maxZoom = 13
      break

    default:
      throw new Error(`Invalid ${sat}`)
  }

  let params = { 'access_token': accessToken }
  // RGB
  if ($('#rgb').hasClass('active')) {
    const r = document.getElementById('r').value
    const g = document.getElementById('g').value
    const b = document.getElementById('b').value
    params.bands = [r, g, b].join(',')
    params.color_formula = encodeURIComponent(
      document.getElementById('color-formula-3bands-input').value
    )

    if (params.bands === '4,3,2' && sat === 'landsat') params.pan = 'True'

    // BAND
  } else if ($('#band').hasClass('active')) {
    params.bands = $('#band-buttons button.active')[0].getAttribute('value')
    params.color_formula = encodeURIComponent(
      document.getElementById('color-formula-1band-input').value
    )

    if (['10', '11'].indexOf(params.bands) !== -1 && sat === 'landsat') {
      delete params.color_formula
      params.rescale = '220,320'
      params.color_map = 'cfastie'
    }

    // PROCESSING
  } else if ($('#process').hasClass('active')) {
    params.expr = encodeURIComponent(document.getElementById('ratio-selection').value)

    if (scope.tileOps.rescale) {
      params.rescale = scope.tileOps.rescale
    } else params.rescale = '-1,1'

    if (scope.tileOps.color_map) {
      params.color_map = scope.tileOps.color_map
    } else params.color_map = 'cfastie'
  }

  url = `${endpoint}/tiles/${meta.sceneid}/{z}/{x}/{y}@${scope.tileScale}x.${tileFormat}`
  const tileParams = Object.keys(params).map(i => `${i}=${params[i]}`).join('&')
  // NOTE: Calling 512x512px tiles is a bit longer but gives a
  // better quality image and reduce the number of tiles requested

  // HACK: Trade-off between quality and speed. Setting source.tileSize to 512 and telling landsat-tiler
  // to get 256x256px reduces the number of lambda calls (but they are faster)
  // and reduce the quality because MapboxGl will oversample the tile.

  map.addSource('raster-tiles', {
    type: 'raster',
    tiles: [ `${url}?${tileParams}` ],
    attribution: attribution,
    bounds: scope.imgMetadata.bounds,
    tileSize: tileSize,
    minzoom: minZoom,
    maxzoom: maxZoom
  })
  map.addLayer({
    id: 'raster-tiles',
    type: 'raster',
    source: 'raster-tiles',
    paint: {
      // 'raster-opacity': scope.tileConfig.opacity,
      'raster-contrast': scope.tileConfig.contrast,
      'raster-saturation': scope.tileConfig.saturation
    }
  })
  map.getLayer('raster-tiles').top = false

  $('#btn-text').removeClass('none')
  $('#dl').removeClass('none')

  const extent = scope.imgMetadata.bounds
  const llb = mapboxgl.LngLatBounds.convert([[extent[0], extent[1]], [extent[2], extent[3]]])
  if (map.getZoom() <= minZoom) map.fitBounds(llb)

  let historyParams = {
    sceneid: meta.sceneid,
    scale: scope.tileScale,
    format: scope.tileFormat,
    saturation: scope.tileConfig.saturation,
    contrast: scope.tileConfig.contrast
    // opacity: scope.tileConfig.opacity
  }
  if (params.expr) historyParams.expr = params.expr
  if (params.bands) historyParams.bands = params.bands
  if (params.color_formula) historyParams.color_formula = params.color_formula
  if (params.color_map) historyParams.color_map = params.color_map
  if (params.rescale) historyParams.rescale = params.rescale
  setHistory(historyParams)
}

const reset = () => {
  if (map.getLayer('raster-tiles')) map.removeLayer('raster-tiles')
  if (map.getSource('raster-tiles')) map.removeSource('raster-tiles')

  map.setFilter('Highlighted', ['any', ['in', 'Name', ''], ['in', 'PATH', '']])
  map.setFilter('Selected', ['any', ['in', 'Name', ''], ['in', 'PATH', '']])

  $('.list-img').scrollLeft(0)
  $('.list-img').empty()

  $('.metaloader').addClass('off')
  $('.scenes-info span').text('')
  $('.scenes-info').addClass('none')
  $('#btn-clear').addClass('none')
  $('#btn-text').addClass('none')
  $('#dl').addClass('none')

  scope.tileConfig = {
    saturation: 0,
    contrast: 0
    // opacity: 1
  }
  scope.tileOps = {}
  scope.tileFormat = 'png'
  scope.tileScale = 1
  delete scope.imgMetadata

  $('.map').removeClass('in')
  $('.list-img').addClass('none')
  map.resize()

  $('.errorMessage').addClass('none')
  setHistory({})
}

const switchPane = (event) => {
  $('#toolbar li').removeClass('active')
  $('#menu-content section').removeClass('active')
  $(`#toolbar #${event.id}`).addClass('active')
  $(`#menu-content #${event.id}`).addClass('active')

  if (event.id === 'process') {
    $('#params').addClass('none')
  } else $('#params').removeClass('none')

  if (event.id === 'config') return
  if (map.getSource('raster-tiles')) updateRasterTile()
}

document.getElementById('rgb-selection').addEventListener('change', (e) => {
  let rgb = e.target.value
  if (rgb === 'custom') {
    $('#rgb-buttons select').prop('disabled', false)
  } else {
    $('#rgb-buttons select').prop('disabled', true)
    rgb = rgb.split(',')
    document.getElementById('r').value = rgb[0]
    document.getElementById('g').value = rgb[1]
    document.getElementById('b').value = rgb[2]
    if (map.getSource('raster-tiles')) updateRasterTile()
  }
})

document.getElementById('r').addEventListener('change', () => {
  if (document.getElementById('rgb-selection').value !== 'custom') return
  if (map.getSource('raster-tiles')) updateRasterTile()
})

document.getElementById('g').addEventListener('change', () => {
  if (document.getElementById('rgb-selection').value !== 'custom') return
  if (map.getSource('raster-tiles')) updateRasterTile()
})

document.getElementById('b').addEventListener('change', () => {
  if (document.getElementById('rgb-selection').value !== 'custom') return
  if (map.getSource('raster-tiles')) updateRasterTile()
})

document.getElementById('ratio-selection').addEventListener('change', () => {
  if (map.getSource('raster-tiles')) updateRasterTile()
})

document.getElementById('set-cf').onclick = () => {
  if (map.getSource('raster-tiles')) updateRasterTile()
}

// document.getElementById('opacity-range').addEventListener('change', () => {
//   const value = document.getElementById('opacity-value').value
//   scope.tileConfig.opacity = parseInt(value) / 100
//   // TODO: Update url
//   if (!map.getSource('raster-tiles')) return
//   map.setPaintProperty('raster-tiles', 'raster-opacity', parseInt(value) / 100)
// })

document.getElementById('contrast-range').addEventListener('change', () => {
  const value = document.getElementById('contrast-value').value
  document.getElementById('contrast-txt').textContent = value
  scope.tileConfig.contrast = parseFloat(value)
  // TODO: Update url
  if (!map.getSource('raster-tiles')) return
  updateHistory({ contrast: value })
  map.setPaintProperty('raster-tiles', 'raster-contrast', parseFloat(value))
})

document.getElementById('saturation-range').addEventListener('change', () => {
  const value = document.getElementById('saturation-value').value
  document.getElementById('saturation-txt').textContent = value
  scope.tileConfig.saturation = parseFloat(value)
  // TODO: Update url
  if (!map.getSource('raster-tiles')) return
  updateHistory({ saturation: value })
  map.setPaintProperty('raster-tiles', 'raster-saturation', parseFloat(value))
})

const updateBands = (e) => {
  $('#band-buttons .btn').removeClass('active')
  $(e).addClass('active')
  if (map.getSource('raster-tiles')) updateRasterTile()
}

document.getElementById('btn-clear').onclick = () => { reset() }

document.getElementById('btn-text').onclick = () => {
  if (!map.getLayer('raster-tiles')) return

  if (map.getLayer('raster-tiles').top === true) {
    map.moveLayer('raster-tiles')
    map.getLayer('raster-tiles').top = false
  } else {
    map.moveLayer('raster-tiles', 'water')
    map.getLayer('raster-tiles').top = true
  }
}

document.getElementById('dl').addEventListener('click', () => {
  map.getCanvas().toBlob((blob) => {
    const imgName = `${scope.imgMetadata.sceneid}.png`
    saveAs(blob, imgName)
  })
})

document.getElementById('btn-hide').addEventListener('click', () => {
  $('#left').toggleClass('off')
  $('#menu').toggleClass('off')
})

document.getElementById('basemap-selection').addEventListener('change', (e) => {
  if (map.getLayer('basemap')) map.removeLayer('basemap')
  if (map.getSource('basemap')) map.removeSource('basemap')

  let basemap = e.target.value

  switch (basemap) {
    case 'sentinel2-cloudless':
      map.addLayer({
        'id': 'basemap',
        'type': 'raster',
        'source': {
          'type': 'raster',
          'tiles': [
            'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg'
          ],
          'attribution': 'Sentinel-2 cloudless - <a href="https://s2maps.eu">https://s2maps.eu</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016 & 2017)',
          'tileSize': 256
        }
      }, 'background')

      return
    default:
      const dateValue = moment().utc().subtract(1, 'day').format('YYYY-MM-DD')
      const basemapsUrl = `https://map1.vis.earthdata.nasa.gov/wmts-webmerc/${basemap}/default/${dateValue}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`
      const attrib = '<a href="https://earthdata.nasa.gov/about/science-system-description/eosdis-components/global-imagery-browse-services-gibs"> NASA EOSDIS GIBS</a>'
      map.addLayer({
        'id': 'basemap',
        'type': 'raster',
        'source': {
          'type': 'raster',
          'tiles': [
            basemapsUrl
          ],
          'attribution': attrib,
          'tileSize': 256,
          'minzoom': 1,
          'maxzoom': 9
        }
      }, 'background')
  }
})

const showSiteInfo = () => {
  $('.site-info').toggleClass('in')
  map.resize()
}

const getFeatures = (e) => {
  let features = map.queryRenderedFeatures(e.point, {layers: ['Grid']})
  let pr = ['in', 'PATH', '']
  if (features.length !== 0) {
    pr =  [].concat.apply([], ['any', features.map(e => {
      return ['all', ['==', 'PATH', e.properties.PATH], ['==', 'ROW', e.properties.ROW]]
    })])
  }

  map.setFilter('Highlighted', pr)
  return features
}

const switchSat = () => {
  const sat = $('.map-top-right .toggle-group input:checked')[0].getAttribute('sat')
  switch (sat) {
    case 'landsat':
      landsatUI()
      break
    case 'cbers':
      cbersUI()
      break
    default:
      throw new Error(`Invalid ${sat}`)
  }
  addLayers(sat)
}

const updateSat = () => {
  reset()

  document.getElementById('contrast-value').value = 0
  document.getElementById('contrast-txt').textContent = '0'
  document.getElementById('saturation-value').value = 0
  document.getElementById('saturation-txt').textContent = '0'

  switchSat()
}

const updateUI = (params) => {
  if (params.bands) {
    const rgb = params.bands.split(',')
    if (rgb.length === 1) {
      updateBands($(`#band-buttons [value='${rgb[0]}']`))
      if (params.color_formula) document.getElementById('color-formula-1band-input').value = decodeURIComponent(params.color_formula)
      switchPane({ id: 'band' })
    } else {
      document.getElementById('r').value = rgb[0]
      document.getElementById('g').value = rgb[1]
      document.getElementById('b').value = rgb[2]
      $('#rgb-selection').val('custom').change()
      $('#rgb-buttons select').prop('disabled', false)
      if (params.color_formula) document.getElementById('color-formula-3bands-input').value = decodeURIComponent(params.color_formula)
      switchPane({ id: 'rgb' })
    }
  } else if (params.expr) {
    var decodeRatio = decodeURIComponent(params.expr)
    $(`#ratio-selection option[value='${decodeRatio}']`).prop('selected', true)
    $('#ratio-selection').change()
    switchPane({ id: 'process' })
  }

  if (params.contrast) {
    document.getElementById('contrast-value').value = parseFloat(params.contrast)
    document.getElementById('contrast-txt').textContent = params.contrast
  }
  if (params.saturation) {
    document.getElementById('saturation-value').value = parseFloat(params.saturation)
    document.getElementById('saturation-txt').textContent = params.saturation
  }
}

const landsatUI = () => {
  $('#rgb-selection').empty()
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
    '<option value="custom">Custom</option>')

  const rgb = ['r', 'g', 'b']
  rgb.forEach(e => {
    $(`#${e}`).empty()
    $(`#${e}`).append(
      '<option value="1">01</option>' +
      '<option value="2">02</option>' +
      '<option value="3">03</option>' +
      '<option value="4">04</option>' +
      '<option value="5">05</option>' +
      '<option value="6">06</option>' +
      '<option value="7">07</option>' +
      '<option value="7">07</option>' +
      '<option value="9">09</option>' +
      '<option value="10">10</option>' +
      '<option value="11">11</option>')
  })

  $('#r option[value="4"]').attr('selected', 'selected')
  $('#g option[value="3"]').attr('selected', 'selected')
  $('#b option[value="2"]').attr('selected', 'selected')

  $('#band-buttons').empty()
  $('#band-buttons').append(
    '<button onclick="updateBands(this)" value="1" class="btn btn--stroke btn--stroke--2 mx3 my3 txt-m active">01</button>' +
    '<button onclick="updateBands(this)" value="2" class="btn btn--stroke btn--stroke--2 mx3 my3 txt-m">02</button>' +
    '<button onclick="updateBands(this)" value="3" class="btn btn--stroke btn--stroke--2 mx3 my3 txt-m">03</button>' +
    '<button onclick="updateBands(this)" value="4" class="btn btn--stroke btn--stroke--2 mx3 my3 txt-m">04</button>' +
    '<button onclick="updateBands(this)" value="5" class="btn btn--stroke btn--stroke--2 mx3 my3 txt-m">05</button>' +
    '<button onclick="updateBands(this)" value="6" class="btn btn--stroke btn--stroke--2 mx3 my3 txt-m">06</button>' +
    '<button onclick="updateBands(this)" value="7" class="btn btn--stroke btn--stroke--2 mx3 my3 txt-m">07</button>' +
    '<button onclick="updateBands(this)" value="8" class="btn btn--stroke btn--stroke--2 mx3 my3 txt-m">08</button>' +
    '<button onclick="updateBands(this)" value="9" class="btn btn--stroke btn--stroke--2 mx3 my3 txt-m">09</button>' +
    '<button onclick="updateBands(this)" value="10" class="btn btn--stroke btn--stroke--2 mx3 my3 txt-m">10</button>' +
    '<button onclick="updateBands(this)" value="11" class="btn btn--stroke btn--stroke--2 mx3 my3 txt-m">11</button>')

  $('#ratio-selection').empty()
  $('#ratio-selection').append(
    '<option value="(b5-b4)/(b5+b4)" name="ndvi">NDVI</option>' +
    '<option value="(b2-b5)/(b2+b5)" name="ndsi">NDSI</option>' +
    '<option value="(b5-b6)/(b5+b6)" name="ndwi">NDWI (Gao)</option>' +
    '<option value="(b3-b5)/(b3+b5)" name="ndwi2">NDWI (McFeeters)</option>' +
    '<option value="(b1-b2)/(b1+b2)" name="ac-index">AC-Index</option>')

  document.getElementById('color-formula-3bands-input').value = 'Gamma RGB 3.5 Saturation 1.7 Sigmoidal RGB 15 0.35'
  document.getElementById('color-formula-1band-input').value = 'Gamma RGB 3.5'
}

const cbersUI = () => {
  $('#rgb-selection').empty()
  $('#rgb-selection').append(
    '<option value="7,6,5">Natural Color (7,6,5)</option>' +
    '<option value="8,7,6">Color Infrared Vegetation (8,7,6)</option>' +
    '<option value="custom">Custom</option>')

  const rgb = ['r', 'g', 'b']
  rgb.forEach(e => {
    $(`#${e}`).empty()
    $(`#${e}`).append(
      '<option value="5">05</option>' +
      '<option value="6">06</option>' +
      '<option value="7">07</option>' +
      '<option value="8">08</option>')
  })

  $('#r option[value="7"]').attr('selected', 'selected')
  $('#g option[value="6"]').attr('selected', 'selected')
  $('#b option[value="5"]').attr('selected', 'selected')

  $('#band-buttons').empty()
  $('#band-buttons').append(
    '<button onclick="updateBands(this)" value="5" class="btn btn--stroke btn--stroke--2 mx3 my3 txt-m active">5</button>' +
    '<button onclick="updateBands(this)" value="6" class="btn btn--stroke btn--stroke--2 mx3 my3 txt-m">6</button>' +
    '<button onclick="updateBands(this)" value="7" class="btn btn--stroke btn--stroke--2 mx3 my3 txt-m">7</button>' +
    '<button onclick="updateBands(this)" value="8" class="btn btn--stroke btn--stroke--2 mx3 my3 txt-m">8</button>'
  )

  $('#ratio-selection').empty()
  $('#ratio-selection').append('<option value="(b8-b7)/(b8+b7)" name="ndvi">NDVI</option>')

  document.getElementById('color-formula-3bands-input').value = 'Gamma RGB 1.5 Saturation 1.1'
  document.getElementById('color-formula-1band-input').value = 'Gamma R 3'
}

document.getElementById('satellite-toggle').addEventListener('change', updateSat)

const setHistory = (params) => {
  const urlParams = Object.keys(params).map(i => `${i}=${params[i]}`).join('&')
  const newUrl = `${window.location.origin}/?${urlParams}${window.location.hash}`
  window.history.replaceState({}, '', newUrl)
  return true
}

const updateHistory = (params) => {
  const paramsActual = parseParams(window.location.search)
  const newParams = Object.assign(paramsActual, params)

  const urlParams = Object.keys(newParams).map(i => `${i}=${newParams[i]}`).join('&')
  const newUrl = `${window.location.origin}/?${urlParams}${window.location.hash}`
  window.history.replaceState({}, '', newUrl)
  return true
}

var map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/vincentsarago/cjjk5ecved47b2rniungishjt',
  center: [ -70.50, 40 ],
  zoom: 3,
  attributionControl: true,
  preserveDrawingBuffer: true,
  hash: true,
  minZoom: 3,
  maxZoom: 15
})

map.addControl(new mapboxgl.NavigationControl(), 'top-right')
map.addControl(new mapboxgl.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-right')

map.on('mousemove', (e) => { getFeatures(e) })

map.on('click', (e) => {
  $('.errorMessage').addClass('none')
  const features = getFeatures(e)
  if (features.length !== 0) {
    let pr
    const sat = $('.map-top-right .toggle-group input:checked')[0].getAttribute('sat')
    switch (sat) {
      case 'landsat':
        pr = [].concat.apply([], ['any', features.map(e => {
          return ['all', ['==', 'PATH', e.properties.PATH], ['==', 'ROW', e.properties.ROW]]
        })])
        map.setFilter('Selected', pr)
        buildQueryAndRequestL8(features)
        break
      case 'cbers':
        pr = [].concat.apply([], ['any', features.map(e => {
          return ['all', ['==', 'PATH', e.properties.PATH], ['==', 'ROW', e.properties.ROW]]
        })])
        map.setFilter('Selected', pr)
        buildQueryAndRequestCBERS(features)
        break
      default:
        throw new Error(`Invalid ${sat}`)
    }

    const geojson = { 'type': 'FeatureCollection', 'features': features }
    const extent = turf.bbox(geojson)
    const llb = mapboxgl.LngLatBounds.convert([[extent[0], extent[1]], [extent[2], extent[3]]])
    if (map.getZoom() <= 3) map.fitBounds(llb, { padding: 200 })
  }
})

const addLayers = (sourceId) => {
  if (map.getLayer('Grid')) map.removeLayer('Grid')
  if (map.getLayer('Highlighted')) map.removeLayer('Highlighted')
  if (map.getLayer('Selected')) map.removeLayer('Selected')

  let sourceLayer
  switch (sourceId) {
    case 'landsat':
      sourceLayer = 'Landsat8_Desc_filtr2'
      break
    case 'cbers':
      sourceLayer = 'cbers_grid-41mvmk'
      break
    default:
      throw new Error(`Invalid ${sourceId}`)
  }

  map.addLayer({
    'id': 'Grid',
    'type': 'fill',
    'source': sourceId,
    'source-layer': sourceLayer,
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
  }, 'water')

  map.addLayer({
    'id': 'Highlighted',
    'type': 'fill',
    'source': sourceId,
    'source-layer': sourceLayer,
    'paint': {
      'fill-outline-color': '#1386af',
      'fill-color': '#0f6d8e',
      'fill-opacity': 0.3
    },
    'filter': ['in', 'PATH', '']
  }, 'water')

  map.addLayer({
    'id': 'Selected',
    'type': 'line',
    'source': sourceId,
    'source-layer': sourceLayer,
    'paint': {
      'line-color': '#4c67da',
      'line-width': 3
    },
    'filter': ['in', 'PATH', '']
  }, 'water')
}

map.on('load', () => {
  map.addLayer({
    'id': 'basemap',
    'type': 'raster',
    'source': {
      'type': 'raster',
      'tiles': [
        'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg'
      ],
      'attribution': 'Sentinel-2 cloudless - <a href="https://s2maps.eu">https://s2maps.eu</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016 & 2017)',
      'tileSize': 256
    }
  }, 'background')

  map.addSource('landsat', {
    'type': 'vector',
    'url': 'mapbox://vincentsarago.8ib6ynrs'
  })
  map.addSource('cbers', {
    'type': 'vector',
    'url': 'mapbox://vincentsarago.3a75bnx8'
  })

  addLayers('landsat')
  $('.loading-map').addClass('off')

  const params = parseParams(window.location.search)
  if (params.color_map) scope.tileOps.color_map = params.color_map
  if (params.rescale) scope.tileOps.rescale = decodeURIComponent(params.rescale)

  if (params.saturation) scope.tileConfig.saturation = parseFloat(params.saturation)
  if (params.contrast) scope.tileConfig.contrast = parseFloat(params.contrast)
  // if (params.opacity) scope.tileConfig.opacity = parseInt(params.opacity)

  if (params.format) scope.tileFormat = params.format
  if (params.scale) scope.tileScale = params.scale

  if (params.sceneid) {
    let sceneid = params.sceneid
    let sceneInfo
    let date = ''
    if (/^L[COTEM]08_/.exec(sceneid)) {
      updateUI(params)
      date = sceneid.split('_')[3]
      initSceneL8(sceneid, date)
    } else if (/^L[COTEM]8/.exec(sceneid)) {
      updateUI(params)
      sceneInfo = parseSceneidPre(sceneid)
      initSceneL8(sceneid, sceneInfo.acquisition_date)
    } else if (/^CBERS/.exec(sceneid)) {
      $('.map-top-right .toggle-group input[sat="cbers"]').prop('checked', true)
      cbersUI()
      addLayers('cbers')
      updateUI(params)
      sceneInfo = parseCBERSid(sceneid)
      initSceneCBERS(sceneid, sceneInfo.acquisition_date)
    } else {
      console.warn(`Invalid Sceneid: ${sceneid}`)
    }
    $('#btn-clear').removeClass('none')
  }
})

console.log('You think you can find something here ?')
console.log('The project is fully open-source. Go check github.com/remotepixel/viewer.remotepixel.ca')
