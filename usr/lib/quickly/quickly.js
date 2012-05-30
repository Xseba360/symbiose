new W.ScriptFile('usr/lib/apt/apt.js');

function QuicklyWindow() {
	var that = this;
	
	this._window = $.w.window({
		title: 'Cr&eacute;ateur de paquets Quickly',
		icon: new W.Icon('mimes/package'),
		width: 500,
		height: 350
	});
	
	this._data = {};
	
	this._data.files = [];
	this.addFile = function(file, callback) {
		callback = W.Callback.toCallback(callback);
		
		if (jQuery.inArray(file.get('path'), this._data.files) != -1) {
			callback.success();
			return;
		}
		
		if (/^(home|~)\//.test(file.get('path'))) {
			callback.error();
			W.Error.trigger('Impossible d\'ajouter un fichier du dossier personnel');
			return;
		}
		
		var addFileFn = function(file) {
			var dirs = file.get('path').split('/');
			var currentDir = '';
			for (var i = 0; i < dirs.length; i++) {
				if (!dirs[i]) {
					continue;
				}
				
				currentDir +=  '/' + dirs[i];
				
				if (jQuery.inArray(currentDir, that._data.files) == -1) {
					that._data.files.push(currentDir);
					that._addFile(currentDir);
				}
			}
			that._filesList.list('sort');
		};
		
		if (file.get('is_dir')) {
			this._window.window('loading', true);
			file.contents([function(files) {
				var i = 0;
				var addCurrentFileFn = function() {
					if (i >= files.length) {
						addFileFn(file);
						that._window.window('loading', false);
						callback.success();
					} else {
						var addNextFileFn = function() {
							i++;
							addCurrentFileFn();
						};
						that.addFile(files[i], [addNextFileFn, addNextFileFn]);
					}
				};
				addCurrentFileFn();
			}, function(response) {
				that._window.window('loading', false);
				response.triggerError('Impossible d\'ajouter les fichiers du dossier "'+file.get('path')+'" au paquet');
				callback.error();
			}]);
		} else {
			addFileFn(file);
			
			callback.success();
		}
	};
	this._addFile = function(path) {
		$.w.listItem([path]).appendTo(this._filesList.list('content'));
	};
	this.openAddFileDialog = function() {
		new NautilusFileSelectorWindow({
			parentWindow: that._window,
			selectDirs: true
		}, function(file) {
			if (file) {
				that.addFile(file);
			}
		});
	};
	
	this.removeFile = function(path) {
		this._filesList.list('items').each(function() {
			var thisPath = $(this).listItem('column', 0).text();
			if (thisPath == path || thisPath.indexOf(path + '/') == 0) {
				$(this).remove();
				var index = jQuery.inArray(thisPath, that._data.files);
				delete that._data.files[index];
			}
		});
	};
	this.removeSelectedFiles = function() {
		this._filesList.list('selection').each(function() {
			var path = $(this).listItem('column', 0).text();
			that.removeFile(path);
		});
	};
	
	this._data.attributes = {
		name: '',
		version: '1.0',
		category: 'accessories',
		priority: 'optionnal',
		maintainer: '',
		description: '',
		shortdescription: ''
	};
	this._data.attributesSet = false;
	this.openAttributesWindow = function(callback) {
		callback = W.Callback.toCallback(callback, [function() {}, function() {}]);
		
		var attributesWindow = $.w.window.dialog({
			title: 'Attributs',
			parentWindow: this._window,
			resizable: false
		});
		
		var form = $.w.entryContainer().submit(function() {
			attributesWindow.window('close');
			var attributes = {};
			for (var index in inputs) {
				var input = inputs[index], value = '';
				if ($.webos.widget.is(input, 'textEntry')) {
					value = input.textEntry('value');
				}
				if ($.webos.widget.is(input, 'selectButton')) {
					value = input.selectButton('value');
				}
				if ($.webos.widget.is(input, 'textAreaEntry')) {
					value = input.textAreaEntry('value');
				}
				attributes[index] = value;
			}
			
			if (that._checkAttributes(attributes)) {
				that._data.attributes = attributes;
				that._data.attributesSet = true;
				callback.success();
			} else {
				callback.error();
			}
		}).appendTo(attributesWindow.window('content'));
		
		var inputs = {};
		inputs.name = $.w.textEntry('Nom d\'affichage du paquet :').appendTo(form);
		inputs.version = $.w.textEntry('Version :').appendTo(form);
		inputs.category = $.w.selectButton('Cat&eacute;gorie :').appendTo(form);
		inputs.priority = $.w.selectButton('Priorit&eacute; :', {
			'optionnal': 'Optionnel'
		}).appendTo(form);
		inputs.maintainer = $.w.textEntry('Auteur :').appendTo(form);
		inputs.description = $.w.textAreaEntry('Description :').appendTo(form);
		inputs.shortdescription = $.w.textEntry('Description courte :').appendTo(form);
		
		SPackage.categories(function(cats) {
			inputs.category.selectButton('option', 'choices', cats).selectButton('value', that._data.attributes.category);
		});
		
		for (var index in this._data.attributes) {
			var input = inputs[index], value = this._data.attributes[index];
			if ($.webos.widget.is(input, 'textEntry')) {
				input.textEntry('value', value);
			}
			if ($.webos.widget.is(input, 'selectButton')) {
				input.selectButton('value', value);
			}
			if ($.webos.widget.is(input, 'textAreaEntry')) {
				input.textAreaEntry('value', value);
			}
		}
		
		var buttonContainer = $.w.buttonContainer().appendTo(form);
		$.w.button('Annuler').click(function() {
			attributesWindow.window('close');
		}).appendTo(buttonContainer);
		$.w.button('Valider', true).appendTo(buttonContainer);
		
		attributesWindow.window('open');
	};
	this._checkAttributes = function(attributes) {
		for (var index in attributes) {
			switch (index) {
				case 'name':
				case 'version':
				case 'category':
				case 'priority':
				case 'maintainer':
				case 'description':
				case 'shortdescription':
					if (!attributes[index]) {
						W.Error.trigger('Le champ "'+index+'" est vide');
						return false;
					}
			}
		}
		
		return true;
	};
	
	this._data.dest = null;
	this.openDestWindow = function(callback) {
		callback = W.Callback.toCallback(callback);
		
		new NautilusFileSelectorWindow({
			parentWindow: that._window,
			exists: false,
			title: 'Choisir un dossier de destination'
		}, function(file) {
			if (file) {
				that._data.dest = file;
				callback.success();
			} else {
				callback.error();
			}
		});
	};
	this.build = function() {
		if (this._filesList.list('items').length == 0) {
			W.Error.trigger('Aucun fichier n\'a &eacute;t&eacute; selectionn&eacute;');
			return;
		}
		
		if (!this._data.attributesSet) {
			this.openAttributesWindow(function() {
				that.build();
			});
			return;
		}
		
		if (!this._checkAttributes(this._data.attributes)) {
			return;
		}
		
		if (!this._data.dest) {
			this.openDestWindow(function() {
				that.build();
			});
			return;
		}
		
		var configFile = $('<package></package>');
		var attributes = $('<attributes></attributes>').appendTo(configFile);
		var files = $('<files></files>').appendTo(configFile);
		
		for (var index in this._data.attributes) {
			$('<attribute />', { name: index, value: this._data.attributes[index] }).appendTo(attributes);
		}
		
		this._filesList.list('items').each(function() {
			var path = $(this).listItem('column', 0).text();
			$('<file />', { path: path.substr(1) }).appendTo(files); //On enleve le / dans le chemin vers le fichier
		});
		
		var xmlFile = this._data.dest+'.xml', pkgFile = this._data.dest+'.zip';
		var xml = '<?xml version="1.0" encoding="UTF-8"?>' + "\n" +
		'<package>'+configFile.html()+'</package>';
		
		var saveXmlFn = function(file) {
			file.setContents(xml, [function() {
				generatePkgFn();
			}, function(response) {
				response.triggerError('Impossible de modifier le fichier de configuration du paquet "'+xmlFile+'"');
			}]);
		};
		
		var generatePkgFn = function() {
			var cmd = 'quickly-cli --config-file="'+xmlFile+'" --installed --files-listing=0 --dest="'+pkgFile+'"';
			
			Webos.Cmd.execute(cmd, [function(response) {
				var successWindow = $.w.window.dialog({
					title: 'Paquet g&eacute;n&eacute;r&eacute;',
					parentWindow: this._window,
					resizable: false,
					width: 400
				});
				var windowContents = successWindow.window('content');
				
				$.w.label('<strong>Le paquet a &eacute;t&eacute; g&eacute;n&eacute;r&eacute; !</strong>').appendTo(windowContents);
				
				$.w.spoiler('D&eacute;tails');
				
				var buttons = $.w.buttonContainer().appendTo(windowContents);
				$.w.button('Ouvrir le dossier de destination').click(function() {
					successWindow.window('close');
					new W.ScriptFile('usr/lib/nautilus/nautilus.js');
					var destArray = that._data.dest.split('/');
					destArray.pop();
					new NautilusWindow(destArray.join('/'));
				}).appendTo(buttons);
				$.w.button('Fermer').click(function() {
					successWindow.window('close');
				}).appendTo(buttons);
				
				successWindow.window('open');
			}, function(response) {
				response.triggerError('Impossible de g&eacute;n&eacute;rer le paquet');
			}]);
		};
		
		W.File.load(xmlFile, [function(file) {
			saveXmlFn(file);
		}, function() {
			W.File.createFile(xmlFile, [function(file) {
				saveXmlFn(file);
			}, function(response) {
				response.triggerError('Impossible de cr&eacute;er le fichier de configuration du paquet "'+xmlFile+'"');
			}]);
		}]);
	};
	
	this.openAboutWindow = function() {
		var aboutWindow = $.w.window.about({
			name: 'Quickly',
			version: '1.0',
			description: 'Quickly permet de g&eacute;n&eacute;rer rapidement des paquets.',
			author: '$imon',
			icon: new W.Icon('mimes/package')
		});
		aboutWindow.window('open');
	};
	
	this._filesList = $.w.list(['Fichier']).appendTo(this._window.window('content'));
	
	this._buttons = {};
	
	var headers = this._window.window('header');
	
	var menu = $.w.menuWindowHeader().appendTo(headers);
	
	var fileItem = $.w.menuWindowHeaderItem('Fichier').appendTo(menu);
	fileItemContent = fileItem.menuWindowHeaderItem('content');
	
	$.w.menuWindowHeaderItem('Nouveau paquet')
		.click(function() {
			new QuicklyWindow();
		})
		.appendTo(fileItemContent);
	
	$.w.menuWindowHeaderItem('G&eacute;n&eacute;rer le paquet')
		.click(function() {
			that.build();
		})
		.appendTo(fileItemContent);
	
	$.w.menuWindowHeaderItem('Quitter')
		.click(function() {
			that._window.window('close');
		})
		.appendTo(fileItemContent);
	
	var editItem = $.w.menuWindowHeaderItem('&Eacute;dition').appendTo(menu);
	editItemContent = editItem.menuWindowHeaderItem('content');
	
	$.w.menuWindowHeaderItem('Ajouter des fichiers')
		.click(function() {
			that.openAddFileDialog();
		})
		.appendTo(editItemContent);
	$.w.menuWindowHeaderItem('Supprimer les fichiers s&eacute;lectionn&eacute;s')
		.click(function() {
			that.removeSelectedFiles();
		})
		.appendTo(editItemContent);
	$.w.menuWindowHeaderItem('Attributs du paquet...')
		.click(function() {
			that.openAttributesWindow();
		})
		.appendTo(editItemContent);
	$.w.menuWindowHeaderItem('Changer le dossier de destination')
		.click(function() {
			that.openDestWindow();
		})
		.appendTo(editItemContent);
	
	var helpItem = $.w.menuWindowHeaderItem('Aide').appendTo(menu);
	helpItemContent = helpItem.menuWindowHeaderItem('content');
	
	$.w.menuWindowHeaderItem('&Agrave; propos')
		.click(function() {
			that.openAboutWindow();
		})
		.appendTo(helpItemContent);
	
	
	var toolbar = $.w.toolbarWindowHeader().appendTo(headers);
	
	this._buttons.newPackage = $.w.toolbarWindowHeaderItem('Ajouter des fichiers', new W.Icon('actions/add', 'button'))
		.click(function() {
			that.openAddFileDialog();
		})
		.appendTo(toolbar);
	this._buttons.open = $.w.toolbarWindowHeaderItem('', new W.Icon('actions/remove', 'button'))
		.click(function() {
			that.removeSelectedFiles();
		})
		.appendTo(toolbar);
	this._buttons.attributes = $.w.toolbarWindowHeaderItem('Attributs', new W.Icon('actions/document-properties', 'button'))
		.click(function() {
			that.openAttributesWindow();
		})
		.appendTo(toolbar);
	this._buttons.build = $.w.toolbarWindowHeaderItem('G&eacute;n&eacute;rer le paquet', new W.Icon('mimes/package', 'button'))
		.click(function() {
			that.build();
		})
		.appendTo(toolbar);
	
	this._window.window('open');
}