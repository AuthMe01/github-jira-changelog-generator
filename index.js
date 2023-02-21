const fs = require('fs');
const readline = require('readline');
const JiraApi = require('jira-client');
const core = require('@actions/core');

// Input
const host = core.getInput('host', { required: true });
const userName = core.getInput('userName', { required: true });
const password = core.getInput('multilineInputName', { required: true });
const projectKey = core.getInput('projectKey', { required: true });
var fileName = core.getInput('fileName', { required: false });
if (!fileName) {
  fileName = 'CHANGELOG.md';
}

const jira = new JiraApi({
  protocol: 'https',
  host: host,
  username: userName,
  password: password,
  apiVersion: '2',
  strictSSL: true
});

const mergedPatern = '**Merged pull requests:**';
const ticketNumberRegex = new RegExp(`${projectKey}-\\d+`, 'g');
const ticketNumberPatern = new RegExp(`\\\\#${projectKey}-\\d+`, 'g');
const typeRegex = /^- (feat|feature|bugfix|fix|breaking-changes)/i;
const typePatern = /^- (feat|feature|bugfix|fix|breaking-changes)\//i;
const Status = {
  ready: 'ready',
  start: 'start',
  stop: 'stop',
};

function start() {
  const fileStream = fs.createReadStream('history.md');
  const reader = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  var status = Status.stop;
  const issueNums = new Set();
  reader.on('line', (line) => {
    if (status == Status.stop && line.includes(mergedPatern)) {
      status = Status.ready;
    } else if (status == Status.ready && !line) {
      status = Status.start;
    } else if (status == Status.start && !line) {
      status = Status.stop;
    }
    if (status == Status.start) {
      var nums = line.match(ticketNumberRegex);
      if (nums) {
        nums.forEach(num => issueNums.add(num))
      }
    }
  });
  reader.on('close', () => {
    fileStream.destroy();
    const promises = [];
    for (let num of issueNums) {
        promises.push(
          jira.findIssue(num)
            .catch((e) => {
              console.error(`${num} Error: ${e}`);
              return null;
            })
            .then((issue) => {
              if (!issue) {
                return null;
              }
              return {
                key: num,
                value: issue.fields.summary,
              };
            })
        );
    }
    core.info(`Fetching ${issueNums.size} issues...`);
    Promise.all(promises)
        .then((issues) => {
            const filteredIssues = issues.filter((issue) => issue !== null);
            const map = new Map(filteredIssues.map((issue) => [issue.key, issue.value]));
            console.log('All issues fetched.');
            return map;
        })
        .then((issueMap) => {
            generate(issueMap);
        })
        .catch((e) => {
            core.setFailed(e);
        });
  });
}
  
function generate(issueMap) {
  const fileStream = fs.createReadStream('history.md');
  const reader = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  var payload = {
    "features": [],
    "fixes": [],
    "breakingChanges": [],
    "others": [],
  };
  var status = Status.stop;
  reader.on('line', (line) => {
      if (status == Status.stop && line.includes(mergedPatern)) {
        status = Status.ready;
      } else if (status == Status.ready && !line) {
        status = Status.start;
      } else if (status == Status.start && !line) {
        status = Status.stop;
        writePayload(payload, issueMap);
        clearPayload(payload);
      }

      if (status == Status.start) {
        var nums = line.match(ticketNumberRegex);
        if (!nums) {
          nums = [];
        }
        var type = line.match(typeRegex);
        if (type) {
          type = type[1];
        } else {
          type = 'others';
        }
        switch (type) {
          case 'feat':
          case 'feature':
            payload.features.push({ nums: nums, message: line });
            break;
          case 'bugfix':
          case 'fix':
            payload.fixes.push({ nums: nums, message: line });
            break;
          case 'breaking-changes':
            payload.breakingChanges.push({ nums: nums, message: line });
            break;
          default:
            payload.others.push({ nums: nums, message: line });
            break;
        }
      } else if (status == Status.stop) {
        fs.appendFileSync('message.txt', `${line}\n`);
      }
  });
}

function writePayload(payload, issueMap) {
  var message = '';
  if (payload.features.length > 0) {
    message += '\n**Changed features:**\n';
    message += getItemsMessage(payload.features, issueMap);
  }
  if (payload.fixes.length > 0) {
    message += '\n**Fixed:**\n';
    message += getItemsMessage(payload.fixes, issueMap);
  }
  if (payload.breakingChanges.length > 0) {
    message += '\n**Breaking Changes:**\n';
    message += getItemsMessage(payload.breakingChanges, issueMap);
  }
  if (payload.others.length > 0) {
    message += '\n**Others:**\n';
    message += getItemsMessage(payload.others, issueMap);
  }
  fs.appendFileSync('message.txt', message);
}

function getItemsMessage(items, issueMap) {
  var message = '';
  for (let item of items) {
    const itemMessage = item.message
      .replace(ticketNumberPatern, '')
      .replace(typePatern, '- ');
    message += `${itemMessage}\n`;
    if (item.nums) {
      for (let i = 0; i < item.nums.length; i++) {
        const url = `(https://${host}/browse/${item.nums[i]})`;
        const summary = issueMap.get(item.nums[i]);
        message += `  - [${item.nums[i]}]${url} ${summary}\n`;
      }
    }
  }
  if (message) {
    message += '\n';
  }
  return message;
}

function clearPayload(payload) {
  payload.features = [];
  payload.fixes = [];
  payload.breakingChanges = [];
  payload.others = [];
}

start();