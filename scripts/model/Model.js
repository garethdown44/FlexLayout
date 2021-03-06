import RowNode from "./RowNode.js";
import Actions from "./Actions.js";
import TabNode from "./TabNode.js";
import TabSetNode from "./TabSetNode.js";
import JsonConverter from "../JsonConverter.js";
import Rect from "../Rect.js";

/**
 * Class containing the Model used by the FlexLayout component
 */
class Model
{
	constructor(json)
	{
		this._idMap = {};
		this._root = new RowNode(this, {});
		this._listeners = [];
		this._rect = new Rect(0,0,0,0);
		this._activeTabSet = null;
		jsonConverter.fromJson(json, this);

		// add a tabset
		var node = new TabSetNode(this, {});
		this._root._addChild(node);
	}

	/**
	 * Get the currently active tabset node
	 * @returns {null|TabSetNode}
	 */
	getActiveTabset()
	{
		// check activeTabSet is still in tree
		var found = false;
		this.visitNodes((node)=>{
			if (!found && node == this._activeTabSet)
			{
				found = true;
			}
		});

		if (!found)
		{
			this._activeTabSet = null;
		}
		return this._activeTabSet;
	}

	/**
	 * Gets the root RowNode of the model
	 * @returns {RowNode|*}
	 */
	getRoot()
	{
		return this._root;
	}

	/**
	 * Gets the rectangle of the associated Layout control
	 * @returns {Rect}
	 */
	getRect()
	{
		return this._rect;
	}

	/**
	 * Visits all the nodes in the model and call the given function for each
	 * @param fn a function that takes visited node and a integer level as parameters
	 */
	visitNodes(fn)
	{
		this._root._forEachNode(fn, 0);
	}

	/**
	 * Gets a node by its id (where an id has been set in the initial json)
	 * @param id the id to find
	 * @returns {null|Node}
	 */
	getNodeById(id)
	{
		return this._idMap[id];
	}

	/**
	 * Update the model by performing the given action,
	 * Actions should be generated via static methods on the Actions class
	 * @param action the action to perform
	 */
	doAction(action)
	{
		console.log("doAction: " + action.name);
		switch (action.name)
		{
			case Actions.ADD_NODE: // add is an alias for move node where fromnode has no parent
			case Actions.MOVE_NODE:
			{
				let toNode =  action.toNode;
				let fromNode =  action.fromNode;
				toNode._drop(fromNode, action.location, action.index);
				break;
			}
			case Actions.DELETE_TAB:
			{
				let node =  action.node;
				node._delete();
				break;
			}
			case Actions.RENAME_TAB:
			{
				let node =  action.node;
				node._setName(action.text);
				break;
			}
			case Actions.SELECT_TAB:
			{
				let tabNode =  action.tabNode;
				let parent = tabNode.getParent();
				let pos = parent.getChildren().indexOf(tabNode);

				if (parent.getSelected() != pos) {
					parent._setSelected(pos);
				}
				this._activeTabSet = parent;

				break;
			}
			case Actions.SET_ACTIVE_TABSET:
			{
				let tabsetNode =  action.tabsetNode;
				this._activeTabSet = tabsetNode;
				break;
			}
			case Actions.SET_RECT:
			{
				this._rect = action.rect;
				break;
			}
			case Actions.ADJUST_SPLIT:
			{
				let splitterNode = action.node;
				splitterNode.getParent()._adjustSplit(splitterNode, action.value);
				break;
			}
			case Actions.MAXIMIZE_TOGGLE:
			{
				let node =  action.node;
				node._setMaximized(!node.isMaximized());
				node._fireEvent("maximize", {maximized: node.isMaximized()});
				this._activeTabSet = node;

				break;
			}
			case Actions.UPDATE_MODEL_ATTRIBUTES:
			{
				this._updateAttrs(action.json);
				break;
			}
			case Actions.UPDATE_NODE_ATTRIBUTES:
			{
				let node =  action.node;
				node._updateAttrs(action.json);
				break;
			}
		}
		this._layout(this._rect);
		this._fireChange();
	}

	/**
	 * Converts the model to json that can be serialized and restored via the fromJson() method
	 * @returns {*} json object that represents this model
	 */
	toJson()
	{
		var json = {global:{}, layout:{}};
		jsonConverter.toJson(json.config, this);
		this._root._forEachNode((node)=>{node._fireEvent("save", null);});
		json.layout = this._root._toJson();
		return json;
	}

	/**
	 * Loads the model from the given json representation
	 * @param json the json model to load
	 * @returns {Model} a new Model object
	 */
	static fromJson(json)
	{
		var model = new Model(json.global);

		model._root = RowNode._fromJson(json.layout, model);
		return model;
	}

	/**
	 * Adds a change listener to the model
	 * @param listener function with a onLayoutChange method, that will be called when the model changes
	 */
	addListener(listener)
	{
		this._listeners.push(listener);
	}

	/**
	 * Remove a previously added change listener
	 * @param listener
	 */
	removeListener(listener)
	{
		var index = this._listeners.indexOf(listener);
		if (index != -1)
		{
			this._listeners.splice(index, 1);
		}
	}

	getSplitterSize()
	{
		return this._splitterSize;
	}

	isEnableEdgeDock()
	{
		return this._enableEdgeDock;
	}

	_addNode(node)
	{
		if (node._id != null)
		{
			this._idMap[node._id] = node;
		}
	}

	_fireChange()
	{
		this._listeners.forEach((listener) => {listener.onLayoutChange(this)});
	}

	_layout(rect)
	{
		var start = Date.now();
		this._root._layout(rect);
		console.log("layout time: " + (Date.now() - start));
	}

	_tidy()
	{
		//console.log("before _tidy", this.toString());
		this._root._tidy();
		//console.log("after _tidy", this.toString());
	}

	_updateAttrs(json)
	{
		jsonConverter.updateAttrs(json, this);
	}

	toString()
	{
		var lines = [];
		this._root.toString(lines, "");
		return lines.join("\n");
	}
}

var jsonConverter = new JsonConverter();

// splitter
jsonConverter.addConversion("_splitterSize", "splitterSize", 8);
jsonConverter.addConversion("_enableEdgeDock", "enableEdgeDock", true);

// tab
jsonConverter.addConversion("_tabEnableClose", "tabEnableClose", true);
jsonConverter.addConversion("_tabEnableDrag", "tabEnableDrag", true);
jsonConverter.addConversion("_tabEnableRename", "tabEnableRename", true);
jsonConverter.addConversion("_tabClassName", "tabClassName", null);
jsonConverter.addConversion("_tabIcon", "tabIcon", null);

// tabset
jsonConverter.addConversion("_tabSetEnableClose", "tabSetEnableClose", true);
jsonConverter.addConversion("_tabSetEnableDrop", "tabSetEnableDrop", true);
jsonConverter.addConversion("_tabSetEnableDrag", "tabSetEnableDrag", true);
jsonConverter.addConversion("_tabSetEnableDivide", "tabSetEnableDivide", true);
jsonConverter.addConversion("_tabSetEnableMaximize", "tabSetEnableMaximize", true);
jsonConverter.addConversion("_tabSetClassNameTabStrip", "tabSetClassNameTabStrip", null);
jsonConverter.addConversion("_tabSetClassNameHeader", "tabSetClassNameHeader", null);
jsonConverter.addConversion("_tabSetEnableTabStrip", "tabSetEnableTabStrip", true);
jsonConverter.addConversion("_tabSetHeaderHeight", "tabSetHeaderHeight", 20);
jsonConverter.addConversion("_tabSetTabStripHeight", "tabSetTabStripHeight", 20);

//console.log(jsonConverter.toTable());

// model callbacks allowDrag, allowDrop(from, to, location), using _canDockInto
// or model listener for all attributes enables etc
export default Model;