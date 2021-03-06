//
// This web interface has been quickly thrown together. It's not production code.
//

outputsHandler = {}

outputsHandler.findById = (id) => {
    return outputsHandler.items.find(i => i.id === id)
}

outputsHandler.draw = function() {
    if (!outputsHandler.items) outputsHandler.items = []
    outputsHandler._drawCards()
    preview.drawPreviewMenu()
}

outputsHandler.showFormToAdd = function() {
    outputsHandler._showForm({})
}

outputsHandler.showFormToEdit = function(overlay) {
    outputsHandler._showForm(overlay)
}

outputsHandler._drawCards = () => {
    $('#cards').append(outputsHandler.items.map(outputsHandler._asCard))
}

outputsHandler._asCard = (output) => {
    return components.card({
        title: 'Output ' + output.id + ' (' + prettyType(output.type) + ')',
        options: outputsHandler._optionButtonsForOutput(output),
        body: outputsHandler._outputCardBody(output),
        state: components.stateBox(output, outputsHandler.setState),
    })
}

outputsHandler._optionButtonsForOutput = (output) => {
    return components.deleteButton().click(() => { outputsHandler.delete(output); return false })
}

outputsHandler._outputCardBody = (output) => {
    var details = []
    if (output.current_num_peers) {
        details.push('<strong>Number of connections:</strong> ' + output.current_num_peers)
    }
    if (output.props.location) {
        details.push('<strong>Location:</strong> ' + output.props.location)
    }
    else if (output.props.uri) {
        details.push('<strong>URI:</strong> <code>' + output.props.uri + '</code></div>')
    }
    else if (output.props.host && output.props.port && output.type === 'tcp') {
        current_domain = $('<a>').attr('href', document.location.href).prop('hostname');
        host = current_domain === '127.0.0.1' ? output.props.host : current_domain
        // Instead of domain we can use output.props.host but it may be an internal (private) IP
        details.push('<strong>URI:</strong> <code>tcp://' + host + ':' + output.props.port + '</code> (Use VLC to watch this)')
        details.push('<strong>Container:</strong> <code>' + output.props.container + '</code>')
    }

    if (output.props.hasOwnProperty('width') &&
        output.props.hasOwnProperty('height')) details.push('<strong>Ouput size:</strong> ' + prettyDimensions(output.props))

    if (output.props.audio_bitrate) {
        details.push('<strong>Audio bitrate:</strong> ' + output.props.audio_bitrate)
    }

    if (output.hasOwnProperty('error_message')) details.push('<strong>ERROR:</strong> <span style="color:red">' + output.error_message + '</span>')

    return details.map(d => $('<div></div>').append(d))
}

outputsHandler._requestNewWebRtcOutput = function() {
    outputsHandler._submitCreateOrEdit(null, {type: 'webrtc'},(response) => {
        if (response && response.hasOwnProperty('id')) {
            preview.previewOutput('webrtc', response.id)
        }
    })
}

outputsHandler._requestNewImageOutput = function() {
    outputsHandler._submitCreateOrEdit(null, {type: 'image'}, (response) => {
        if (response && response.hasOwnProperty('id')) {
            preview.previewOutput('image', response.id)
        }
        else {
            showMessage('Unable to create image output', 'warning')
        }
    })
}

function getVideoElement() {
    return document.getElementById('stream');
}

outputsHandler.delete = function(output) {
    $.ajax({
        contentType: "application/json",
        type: 'DELETE',
        url: 'api/outputs/' + output.id,
        dataType: 'json',
        success: function() {
            showMessage('Successfully deleted output ' + output.id, 'success')
            updatePage()
        },
        error: function() {
            showMessage('Sorry, an error occurred whilst deleting output ' + output.id, 'warning')
        }
    });
}

outputsHandler._handleNewFormType = function(event) {
    outputsHandler._populateForm({type: event.target.value})
}

outputsHandler._showForm = function(output) {
    outputsHandler.currentForm = $('<form></form>')
    var label = output && output.hasOwnProperty('id') ? 'Edit output ' + output.id : 'Add output'
    showModal(label, outputsHandler.currentForm, outputsHandler._handleFormSubmit)
    outputsHandler._populateForm(output)
}

outputsHandler._populateForm = function(output) {
    var form = outputsHandler.currentForm
    form.empty()
    if (!output.props) output.props = {}
    form.append(outputsHandler._getOutputsSelect(output))
    if (!output.type) {
    }
    else if (output.type === 'local') {
        form.append('<div>(There are no extra settings for local outputs.)</div>');
    }
    else if (output.type === 'tcp') {
        form.append(formGroup({
            id: 'output-container',
            label: 'Container',
            name: 'container',
            options: {mpeg: 'MPEG', ogg: 'OGG'},
            value: (output.type || 'mpeg')
        }))

        form.append(formGroup({
            id: 'input-audio_bitrate',
            label: 'Audio bitrate',
            name: 'audio_bitrate',
            type: 'number',
            value: output.props.audio_bitrate || '',
            help: 'Leave blank for default (128000)',
            min: 1000,
            step: 1000,
            max: 128000*16
        }))

        form.append(getDimensionsSelect('dimensions', output.props.width, output.props.height))
    }
    else if (output.type === 'rtmp') {
        form.append(formGroup({
            id: 'output-uri',
            label: 'Location (URI)',
            name: 'uri',
            type: 'text',
            value: output.location || '',
            help: 'Example: <code>rtmp://184.72.239.149/vod/BigBuckBunny_115k.mov</code>',
        }));
    }
    else if (output.type === 'file') {
        form.append(formGroup({
            id: 'output-location',
            label: 'Location (filename)',
            name: 'location',
            type: 'text',
            value: output.location || '',
            help: 'Example: <code>/tmp/foo.mp4</code>',
        }));
    }

    form.find('select[name="type"]').change(outputsHandler._handleNewFormType);
}

outputsHandler._getOutputsSelect = function(output) {
    var options = {
        'tcp'  : 'TCP (server)',
        'rtmp' : 'RTMP (send to remote server)',
        'image' : 'JPEG image every 1 second',
        'file' : 'File (Write audio/video to a local file)',
        'webrtc' : 'WebRTC for web preview',
        'local': 'Local (pop-up audio/video on this server, for debugging)',
    }
    return formGroup({
        id: 'output-type',
        label: 'Type',
        name: 'type',
        initialOption: 'Select a type...',
        options,
        value: output.type
    })
}

outputsHandler._handleNewFormType = function(event) {
    outputsHandler._populateForm({type: event.target.value})
}

outputsHandler._handleFormSubmit = function() {
    var form = outputsHandler.currentForm
    var idField = form.find('input[name="id"]')
    var id = idField.length ? idField.val() : null
    var output = (id != null) ? outputsHandler.findById(id) : {}
    var newProps = {}

    fields = ['type', 'uri', 'host', 'port', 'container', 'location', 'audio_bitrate', 'dimensions']
    fields.forEach(function(f) {
        var outputOrSelect = (f === 'type' || f === 'container' || f === 'dimensions') ? 'select' : 'input'
        var output = form.find(outputOrSelect + '[name="' + f + '"]')
        if (output && output.val() != null) {
            newProps[f] = output.val()
        }
    })

    if (newProps.audio_bitrate === '') newProps.audio_bitrate = null

    splitDimensionsIntoWidthAndHeight(newProps)

    var type = newProps.type || output.type

    if (!type) {
        showMessage('Please select a type')
        return
    }
    else if (type === 'rtmp') {
        var uri = newProps.uri || output.uri
        good_uri_regexp = '^rtmp(s?)://'
        if (!uri || !uri.match(good_uri_regexp)) {
            showMessage('uri must start with ' + good_uri_regexp)
            return
        }
    }
    else if (type === 'local' || type === 'tcp' || type === 'image' || type === 'file' || type === 'webrtc') {
        // GREAT
    }
    else {
        showMessage('Invalid type ' + type)
        return
    }

    if (!Object.keys(newProps).length) {
        showMessage('No new values')
        return
    }

    console.log('Submitting new output with values', newProps)
    delete newProps.type
    outputsHandler._submitCreateOrEdit(null, {type: type, props: newProps}, outputsHandler._onNewOutputSuccess)
    hideModal();
}

outputsHandler._onNewOutputSuccess = function() {
    showMessage('Successfully created a new output', 'success')
    updatePage()
}

outputsHandler._submitCreateOrEdit = function(id, values, onSuccess) {
    var type = (id != null) ? 'POST' : 'PUT'
    var url = (id != null) ? 'api/outputs/' + id : 'api/outputs'
    if (Object.keys(values).length === 0) console.trace('_submitCreateOrEdit with no updates! TEMP')
    $.ajax({
        contentType: 'application/json',
        type, url,
        dataType: 'json',
        data: JSON.stringify(values),
        success: onSuccess,
        error: function(response) {
            showMessage(response.responseJSON && response.responseJSON.error ?
                'Error creating output: ' + response.responseJSON.error : 'Error creating output')
        }
    });
}

outputsHandler.setState = function(id, state) {
    return outputsHandler._submitCreateOrEdit(id, {state})
}
