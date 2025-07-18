import type { CancellationToken, ConfigurationChangeEvent, Disposable, Event } from 'vscode';
import { EventEmitter, ProgressLocation, window } from 'vscode';
import type { RepositoriesViewConfig, ViewBranchesLayout, ViewFilesLayout } from '../config';
import type { Container } from '../container';
import type { GitCommit } from '../git/models/commit';
import { isCommit } from '../git/models/commit';
import type { GitContributor } from '../git/models/contributor';
import type {
	GitBranchReference,
	GitRevisionReference,
	GitStashReference,
	GitTagReference,
} from '../git/models/reference';
import type { GitRemote } from '../git/models/remote';
import type { GitWorktree } from '../git/models/worktree';
import { getRemoteNameFromBranchName } from '../git/utils/branch.utils';
import { getReferenceLabel } from '../git/utils/reference.utils';
import { executeCommand } from '../system/-webview/command';
import { configuration } from '../system/-webview/configuration';
import { setContext } from '../system/-webview/context';
import { gate } from '../system/decorators/-webview/gate';
import type { ViewNode } from './nodes/abstract/viewNode';
import { BranchesNode } from './nodes/branchesNode';
import { BranchNode } from './nodes/branchNode';
import { BranchOrTagFolderNode } from './nodes/branchOrTagFolderNode';
import { BranchTrackingStatusNode } from './nodes/branchTrackingStatusNode';
import { CompareBranchNode } from './nodes/compareBranchNode';
import { ContributorNode } from './nodes/contributorNode';
import { ContributorsNode } from './nodes/contributorsNode';
import { ReflogNode } from './nodes/reflogNode';
import { RemoteNode } from './nodes/remoteNode';
import { RemotesNode } from './nodes/remotesNode';
import { RepositoriesNode } from './nodes/repositoriesNode';
import { RepositoryNode } from './nodes/repositoryNode';
import { StashesNode } from './nodes/stashesNode';
import { TagsNode } from './nodes/tagsNode';
import { WorktreeNode } from './nodes/worktreeNode';
import { WorktreesNode } from './nodes/worktreesNode';
import type { GroupedViewContext, RevealOptions } from './viewBase';
import { ViewBase } from './viewBase';
import type { CopyNodeCommandArgs } from './viewCommands';
import { registerViewCommand } from './viewCommands';

export class RepositoriesView extends ViewBase<'repositories', RepositoriesNode, RepositoriesViewConfig> {
	private _onDidChangeAutoRefresh = new EventEmitter<void>();
	get onDidChangeAutoRefresh(): Event<void> {
		return this._onDidChangeAutoRefresh.event;
	}

	protected readonly configKey = 'repositories';

	constructor(container: Container, grouped?: GroupedViewContext) {
		super(container, 'repositories', 'Repositories', 'repositoriesView', grouped);
	}

	override dispose(): void {
		this._onDidChangeAutoRefresh.dispose();
		super.dispose();
	}

	protected getRoot(): RepositoriesNode {
		return new RepositoriesNode(this);
	}

	protected registerCommands(): Disposable[] {
		return [
			registerViewCommand(
				this.getQualifiedCommand('copy'),
				() => executeCommand<CopyNodeCommandArgs>('gitlens.views.copy', this.activeSelection, this.selection),
				this,
			),
			registerViewCommand(
				this.getQualifiedCommand('refresh'),
				() => {
					this.container.git.resetCaches(
						'branches',
						'contributors',
						'remotes',
						'stashes',
						'status',
						'tags',
						'worktrees',
					);
					return this.refresh(true);
				},
				this,
			),
			registerViewCommand(
				this.getQualifiedCommand('setBranchesLayoutToList'),
				() => this.setBranchesLayout('list'),
				this,
			),
			registerViewCommand(
				this.getQualifiedCommand('setBranchesLayoutToTree'),
				() => this.setBranchesLayout('tree'),
				this,
			),
			registerViewCommand(
				this.getQualifiedCommand('setFilesLayoutToAuto'),
				() => this.setFilesLayout('auto'),
				this,
			),
			registerViewCommand(
				this.getQualifiedCommand('setFilesLayoutToList'),
				() => this.setFilesLayout('list'),
				this,
			),
			registerViewCommand(
				this.getQualifiedCommand('setFilesLayoutToTree'),
				() => this.setFilesLayout('tree'),
				this,
			),
			registerViewCommand(
				this.getQualifiedCommand('setAutoRefreshToOn'),
				() => this.setAutoRefresh(configuration.get('views.repositories.autoRefresh'), true),
				this,
			),
			registerViewCommand(
				this.getQualifiedCommand('setAutoRefreshToOff'),
				() => this.setAutoRefresh(configuration.get('views.repositories.autoRefresh'), false),
				this,
			),
			registerViewCommand(this.getQualifiedCommand('setShowAvatarsOn'), () => this.setShowAvatars(true), this),
			registerViewCommand(this.getQualifiedCommand('setShowAvatarsOff'), () => this.setShowAvatars(false), this),
			registerViewCommand(
				this.getQualifiedCommand('setBranchesShowBranchComparisonOn'),
				() => this.setBranchShowBranchComparison(true),
				this,
			),
			registerViewCommand(
				this.getQualifiedCommand('setBranchesShowBranchComparisonOff'),
				() => this.setBranchShowBranchComparison(false),
				this,
			),
			registerViewCommand(
				this.getQualifiedCommand('setBranchesShowStashesOn'),
				() => this.setBranchShowStashes(true),
				this,
			),
			registerViewCommand(
				this.getQualifiedCommand('setBranchesShowStashesOff'),
				() => this.setBranchShowStashes(false),
				this,
			),
			registerViewCommand(
				this.getQualifiedCommand('setShowSectionBranchComparisonOn'),
				() => this.toggleSectionBranchComparison(true),
				this,
			),
			registerViewCommand(
				this.getQualifiedCommand('setShowSectionBranchComparisonOff'),
				() => this.toggleSectionBranchComparison(false),
				this,
			),
			registerViewCommand(
				this.getQualifiedCommand('setShowSectionBranchesOn'),
				() => this.toggleSection('showBranches', true),
				this,
			),
			registerViewCommand(
				this.getQualifiedCommand('setShowSectionBranchesOff'),
				() => this.toggleSection('showBranches', false),
				this,
			),

			registerViewCommand(
				this.getQualifiedCommand('setShowSectionCommitsOn'),
				() => this.toggleSection('showCommits', true),
				this,
			),
			registerViewCommand(
				this.getQualifiedCommand('setShowSectionCommitsOff'),
				() => this.toggleSection('showCommits', false),
				this,
			),

			registerViewCommand(
				this.getQualifiedCommand('setShowSectionContributorsOn'),
				() => this.toggleSection('showContributors', true),
				this,
			),
			registerViewCommand(
				this.getQualifiedCommand('setShowSectionContributorsOff'),
				() => this.toggleSection('showContributors', false),
				this,
			),

			registerViewCommand(
				this.getQualifiedCommand('setShowSectionRemotesOn'),
				() => this.toggleSection('showRemotes', true),
				this,
			),
			registerViewCommand(
				this.getQualifiedCommand('setShowSectionRemotesOff'),
				() => this.toggleSection('showRemotes', false),
				this,
			),

			registerViewCommand(
				this.getQualifiedCommand('setShowSectionStashesOn'),
				() => this.toggleSection('showStashes', true),
				this,
			),
			registerViewCommand(
				this.getQualifiedCommand('setShowSectionStashesOff'),
				() => this.toggleSection('showStashes', false),
				this,
			),

			registerViewCommand(
				this.getQualifiedCommand('setShowSectionTagsOn'),
				() => this.toggleSection('showTags', true),
				this,
			),
			registerViewCommand(
				this.getQualifiedCommand('setShowSectionTagsOff'),
				() => this.toggleSection('showTags', false),
				this,
			),

			registerViewCommand(
				this.getQualifiedCommand('setShowSectionWorktreesOn'),
				() => this.toggleSection('showWorktrees', true),
				this,
			),
			registerViewCommand(
				this.getQualifiedCommand('setShowSectionWorktreesOff'),
				() => this.toggleSection('showWorktrees', false),
				this,
			),
			registerViewCommand(
				this.getQualifiedCommand('setShowSectionUpstreamStatusOn'),
				() => this.toggleSection('showUpstreamStatus', true),
				this,
			),
			registerViewCommand(
				this.getQualifiedCommand('setShowSectionUpstreamStatusOff'),
				() => this.toggleSection('showUpstreamStatus', false),
				this,
			),

			registerViewCommand(
				this.getQualifiedCommand('setShowSectionOff'),
				(
					node:
						| BranchesNode
						| BranchNode
						| BranchTrackingStatusNode
						| CompareBranchNode
						| ContributorsNode
						| ReflogNode
						| RemotesNode
						| StashesNode
						| TagsNode
						| WorktreesNode,
				) => this.toggleSectionByNode(node, false),
				this,
			),
		];
	}

	protected override filterConfigurationChanged(e: ConfigurationChangeEvent): boolean {
		const changed = super.filterConfigurationChanged(e);
		if (
			!changed &&
			!configuration.changed(e, 'defaultDateFormat') &&
			!configuration.changed(e, 'defaultDateLocale') &&
			!configuration.changed(e, 'defaultDateShortFormat') &&
			!configuration.changed(e, 'defaultDateSource') &&
			!configuration.changed(e, 'defaultDateStyle') &&
			!configuration.changed(e, 'defaultGravatarsStyle') &&
			!configuration.changed(e, 'defaultTimeFormat') &&
			!configuration.changed(e, 'sortBranchesBy') &&
			!configuration.changed(e, 'sortContributorsBy') &&
			!configuration.changed(e, 'sortTagsBy') &&
			!configuration.changed(e, 'sortRepositoriesBy')
		) {
			return false;
		}

		return true;
	}

	protected override onConfigurationChanged(e: ConfigurationChangeEvent): void {
		if (configuration.changed(e, `views.${this.configKey}.autoRefresh` as const)) {
			void this.setAutoRefresh(configuration.get('views.repositories.autoRefresh'));
		}

		super.onConfigurationChanged(e);
	}

	get autoRefresh(): boolean {
		return this.config.autoRefresh && this.container.storage.getWorkspace('views:repositories:autoRefresh', true);
	}

	findBranch(branch: GitBranchReference, token?: CancellationToken): Promise<ViewNode | undefined> {
		const { repoPath } = branch;

		if (branch.remote) {
			return this.findNode((n: any) => n.branch?.ref === branch.ref, {
				allowPaging: true,
				maxDepth: 6,
				canTraverse: n => {
					// Only search for branch nodes in the same repo within BranchesNode
					if (n instanceof RepositoriesNode) return true;

					if (n instanceof RemoteNode) {
						if (n.repoPath !== repoPath) return false;

						return branch.remote && n.remote.name === getRemoteNameFromBranchName(branch.name); //branch.getRemoteName();
					}

					if (
						n instanceof RepositoryNode ||
						n instanceof BranchesNode ||
						n instanceof RemotesNode ||
						n instanceof BranchOrTagFolderNode
					) {
						return n.repoPath === repoPath;
					}

					return false;
				},
				token: token,
			});
		}

		return this.findNode((n: any) => n.branch?.ref === branch.ref, {
			allowPaging: true,
			maxDepth: 5,
			canTraverse: n => {
				// Only search for branch nodes in the same repo within BranchesNode
				if (n instanceof RepositoriesNode) return true;

				if (n instanceof RepositoryNode || n instanceof BranchesNode || n instanceof BranchOrTagFolderNode) {
					return n.repoPath === repoPath;
				}

				return false;
			},
			token: token,
		});
	}

	async findCommit(
		commit: GitCommit | { repoPath: string; ref: string },
		token?: CancellationToken,
	): Promise<ViewNode | undefined> {
		const { repoPath } = commit;

		const svc = this.container.git.getRepositoryService(repoPath);

		// Get all the branches the commit is on
		let branches = await svc.branches.getBranchesWithCommits(
			[commit.ref],
			undefined,
			isCommit(commit) ? { commitDate: commit.committer.date } : undefined,
		);
		if (branches.length !== 0) {
			return this.findNode((n: any) => n.commit?.ref === commit.ref, {
				allowPaging: true,
				maxDepth: 6,
				canTraverse: async n => {
					// Only search for commit nodes in the same repo within BranchNodes
					if (n instanceof RepositoriesNode) return true;

					if (
						n instanceof RepositoryNode ||
						n instanceof BranchesNode ||
						n instanceof BranchOrTagFolderNode
					) {
						return n.repoPath === repoPath;
					}

					if (n instanceof BranchNode && n.repoPath === repoPath && branches.includes(n.branch.name)) {
						await n.loadMore({ until: commit.ref });
						return true;
					}

					return false;
				},
				token: token,
			});
		}

		// If we didn't find the commit on any local branches, check remote branches
		branches = await svc.branches.getBranchesWithCommits(
			[commit.ref],
			undefined,
			isCommit(commit) ? { commitDate: commit.committer.date, remotes: true } : { remotes: true },
		);
		if (branches.length === 0) return undefined;

		const remotes = branches.map(b => b.split('/', 1)[0]);

		return this.findNode((n: any) => n.commit?.ref === commit.ref, {
			allowPaging: true,
			maxDepth: 8,
			canTraverse: n => {
				// Only search for commit nodes in the same repo within BranchNode/RemoteNode
				if (n instanceof RepositoriesNode) return true;

				if (n instanceof RemoteNode) {
					return n.repoPath === repoPath && remotes.includes(n.remote.name);
				}

				if (n instanceof BranchNode) {
					return n.repoPath === repoPath && branches.includes(n.branch.name);
				}

				if (n instanceof RepositoryNode || n instanceof RemotesNode || n instanceof BranchOrTagFolderNode) {
					return n.repoPath === repoPath;
				}

				return false;
			},
			token: token,
		});
	}

	findContributor(contributor: GitContributor, token?: CancellationToken): Promise<ViewNode | undefined> {
		const { repoPath, username, email, name } = contributor;

		return this.findNode(
			n =>
				n instanceof ContributorNode &&
				n.contributor.username === username &&
				n.contributor.email === email &&
				n.contributor.name === name,
			{
				maxDepth: 2,
				canTraverse: n => {
					// Only search for contributor nodes in the same repo within a ContributorsNode
					if (n instanceof RepositoriesNode) return true;

					if (n instanceof RepositoryNode || n instanceof ContributorsNode) {
						return n.repoPath === repoPath;
					}

					return false;
				},
				token: token,
			},
		);
	}

	findRemote(remote: GitRemote, token?: CancellationToken): Promise<ViewNode | undefined> {
		const { repoPath } = remote;

		return this.findNode((n: any) => n.remote?.name === remote.name, {
			allowPaging: true,
			maxDepth: 2,
			canTraverse: n => {
				// Only search for remote nodes in the same repo within a RemotesNode
				if (n instanceof RepositoriesNode) return true;

				if (n instanceof RepositoryNode || n instanceof RemotesNode) {
					return n.repoPath === repoPath;
				}

				return false;
			},
			token: token,
		});
	}

	findStash(stash: GitStashReference, token?: CancellationToken): Promise<ViewNode | undefined> {
		const { repoPath } = stash;

		return this.findNode((n: any) => n.commit?.ref === stash.ref, {
			maxDepth: 3,
			canTraverse: n => {
				// Only search for stash nodes in the same repo within a StashesNode
				if (n instanceof RepositoriesNode) return true;

				if (n instanceof RepositoryNode || n instanceof StashesNode) {
					return n.repoPath === repoPath;
				}

				return false;
			},
			token: token,
		});
	}

	findTag(tag: GitTagReference, token?: CancellationToken): Promise<ViewNode | undefined> {
		const { repoPath } = tag;

		return this.findNode((n: any) => n.tag?.ref === tag.ref, {
			allowPaging: true,
			maxDepth: 5,
			canTraverse: n => {
				// Only search for tag nodes in the same repo within TagsNode
				if (n instanceof RepositoriesNode) return true;

				if (n instanceof RepositoryNode || n instanceof TagsNode || n instanceof BranchOrTagFolderNode) {
					return n.repoPath === repoPath;
				}

				return false;
			},
			token: token,
		});
	}

	findWorktree(worktree: GitWorktree, token?: CancellationToken): Promise<ViewNode | undefined> {
		const { repoPath, uri } = worktree;
		const url = uri.toString();

		return this.findNode(n => n instanceof WorktreeNode && n.worktree.uri.toString() === url, {
			maxDepth: 2,
			canTraverse: n => {
				// Only search for worktree nodes in the same repo within WorktreesNode
				if (n instanceof RepositoriesNode) return true;

				if (n instanceof RepositoryNode || n instanceof WorktreesNode || n instanceof BranchOrTagFolderNode) {
					return n.repoPath === repoPath;
				}

				return false;
			},
			token: token,
		});
	}

	@gate(() => '')
	async revealBranch(branch: GitBranchReference, options?: RevealOptions): Promise<ViewNode | undefined> {
		return window.withProgress(
			{
				location: ProgressLocation.Notification,
				title: `Revealing ${getReferenceLabel(branch, {
					icon: false,
					quoted: true,
				})} in the Repositories view...`,
				cancellable: true,
			},
			async (_progress, token) => {
				const node = await this.findBranch(branch, token);
				if (node == null) return undefined;

				await this.revealDeep(node, options);

				return node;
			},
		);
	}

	@gate(() => '')
	async revealBranches(repoPath: string, options?: RevealOptions): Promise<ViewNode | undefined> {
		const node = await this.findNode(n => n instanceof BranchesNode && n.repoPath === repoPath, {
			maxDepth: 2,
			canTraverse: n => {
				// Only search for branches nodes in the same repo
				if (n instanceof RepositoriesNode) return true;

				if (n instanceof RepositoryNode) {
					return n.repoPath === repoPath;
				}

				return false;
			},
		});

		if (node !== undefined) {
			await this.reveal(node, options);
		}

		return node;
	}

	@gate(() => '')
	async revealCommit(commit: GitRevisionReference, options?: RevealOptions): Promise<ViewNode | undefined> {
		return window.withProgress(
			{
				location: ProgressLocation.Notification,
				title: `Revealing ${getReferenceLabel(commit, {
					icon: false,
					quoted: true,
				})} in the Repositories view...`,
				cancellable: true,
			},
			async (_progress, token) => {
				const node = await this.findCommit(commit, token);
				if (node == null) return undefined;

				await this.revealDeep(node, options);

				return node;
			},
		);
	}

	@gate(() => '')
	async revealContributor(contributor: GitContributor, options?: RevealOptions): Promise<ViewNode | undefined> {
		return window.withProgress(
			{
				location: ProgressLocation.Notification,
				title: `Revealing contributor '${contributor.name} in the Repositories view...`,
				cancellable: true,
			},
			async (_progress, token) => {
				const node = await this.findContributor(contributor, token);
				if (node == null) return undefined;

				await this.revealDeep(node, options);

				return node;
			},
		);
	}

	@gate(() => '')
	async revealRemote(remote: GitRemote, options?: RevealOptions): Promise<ViewNode | undefined> {
		return window.withProgress(
			{
				location: ProgressLocation.Notification,
				title: `Revealing remote '${remote.name}' in the side bar...`,
				cancellable: true,
			},
			async (_progress, token) => {
				const node = await this.findRemote(remote, token);
				if (node == null) return undefined;

				await this.revealDeep(node, options);

				return node;
			},
		);
	}

	@gate(() => '')
	async revealRepository(repoPath: string, options?: RevealOptions): Promise<ViewNode | undefined> {
		const node = await this.findNode(n => n instanceof RepositoryNode && n.repoPath === repoPath, {
			maxDepth: 1,
			canTraverse: n => n instanceof RepositoriesNode,
		});

		if (node !== undefined) {
			await this.reveal(node, options);
		}

		return node;
	}

	@gate(() => '')
	async revealStash(stash: GitStashReference, options?: RevealOptions): Promise<ViewNode | undefined> {
		return window.withProgress(
			{
				location: ProgressLocation.Notification,
				title: `Revealing ${getReferenceLabel(stash, {
					icon: false,
					quoted: true,
				})} in the Repositories view...`,
				cancellable: true,
			},
			async (_progress, token) => {
				const node = await this.findStash(stash, token);
				if (node !== undefined) {
					await this.reveal(node, options);
				}

				return node;
			},
		);
	}

	@gate(() => '')
	async revealStashes(repoPath: string, options?: RevealOptions): Promise<ViewNode | undefined> {
		const node = await this.findNode(n => n instanceof StashesNode && n.repoPath === repoPath, {
			maxDepth: 2,
			canTraverse: n => {
				// Only search for stashes nodes in the same repo
				if (n instanceof RepositoriesNode) return true;

				if (n instanceof RepositoryNode) {
					return n.repoPath === repoPath;
				}

				return false;
			},
		});

		if (node !== undefined) {
			await this.reveal(node, options);
		}

		return node;
	}

	@gate(() => '')
	async revealTag(tag: GitTagReference, options?: RevealOptions): Promise<ViewNode | undefined> {
		return window.withProgress(
			{
				location: ProgressLocation.Notification,
				title: `Revealing ${getReferenceLabel(tag, {
					icon: false,
					quoted: true,
				})} in the Repositories view...`,
				cancellable: true,
			},
			async (_progress, token) => {
				const node = await this.findTag(tag, token);
				if (node == null) return undefined;

				await this.revealDeep(node, options);

				return node;
			},
		);
	}

	@gate(() => '')
	async revealTags(repoPath: string, options?: RevealOptions): Promise<ViewNode | undefined> {
		const node = await this.findNode(n => n instanceof TagsNode && n.repoPath === repoPath, {
			maxDepth: 2,
			canTraverse: n => {
				// Only search for tags nodes in the same repo
				if (n instanceof RepositoriesNode) return true;

				if (n instanceof RepositoryNode) {
					return n.repoPath === repoPath;
				}

				return false;
			},
		});

		if (node !== undefined) {
			await this.reveal(node, options);
		}

		return node;
	}

	@gate(() => '')
	async revealWorktree(worktree: GitWorktree, options?: RevealOptions): Promise<ViewNode | undefined> {
		return window.withProgress(
			{
				location: ProgressLocation.Notification,
				title: `Revealing worktree '${worktree.name}' in the side bar...`,
				cancellable: true,
			},
			async (_progress, token) => {
				const node = await this.findWorktree(worktree, token);
				if (node == null) return undefined;

				await this.revealDeep(node, options);

				return node;
			},
		);
	}

	@gate(() => '')
	async revealWorktrees(repoPath: string, options?: RevealOptions): Promise<ViewNode | undefined> {
		const node = await this.findNode(n => n instanceof WorktreesNode && n.repoPath === repoPath, {
			maxDepth: 2,
			canTraverse: n => {
				// Only search for worktrees nodes in the same repo
				if (n instanceof RepositoriesNode) return true;

				if (n instanceof RepositoryNode) {
					return n.repoPath === repoPath;
				}

				return false;
			},
		});

		if (node !== undefined) {
			await this.reveal(node, options);
		}

		return node;
	}

	private async setAutoRefresh(enabled: boolean, workspaceEnabled?: boolean) {
		if (enabled) {
			if (workspaceEnabled === undefined) {
				workspaceEnabled = this.container.storage.getWorkspace('views:repositories:autoRefresh', true);
			} else {
				await this.container.storage.storeWorkspace('views:repositories:autoRefresh', workspaceEnabled);
			}
		}

		void setContext('gitlens:views:repositories:autoRefresh', enabled && workspaceEnabled);

		this._onDidChangeAutoRefresh.fire();
	}

	private setBranchesLayout(layout: ViewBranchesLayout) {
		return configuration.updateEffective(`views.${this.configKey}.branches.layout` as const, layout);
	}

	private setFilesLayout(layout: ViewFilesLayout) {
		return configuration.updateEffective(`views.${this.configKey}.files.layout` as const, layout);
	}

	private setShowAvatars(enabled: boolean) {
		return configuration.updateEffective(`views.${this.configKey}.avatars` as const, enabled);
	}

	private setBranchShowBranchComparison(enabled: boolean) {
		return configuration.updateEffective(
			`views.${this.configKey}.branches.showBranchComparison` as const,
			enabled ? 'branch' : false,
		);
	}

	private setBranchShowStashes(enabled: boolean) {
		return configuration.updateEffective(`views.${this.configKey}.branches.showStashes` as const, enabled);
	}

	async toggleSection(
		key:
			| 'showBranches'
			| 'showCommits'
			| 'showContributors'
			// | 'showIncomingActivity'
			| 'showRemotes'
			| 'showStashes'
			| 'showTags'
			| 'showWorktrees'
			| 'showUpstreamStatus',
		enabled: boolean,
	): Promise<void> {
		return configuration.updateEffective(`views.${this.configKey}.${key}` as const, enabled);
	}

	private toggleSectionBranchComparison(enabled: boolean) {
		return configuration.updateEffective(
			`views.${this.configKey}.showBranchComparison` as const,
			enabled ? 'working' : false,
		);
	}

	async toggleSectionByNode(
		node:
			| BranchesNode
			| BranchNode
			| BranchTrackingStatusNode
			| CompareBranchNode
			| ContributorsNode
			| ReflogNode
			| RemotesNode
			| StashesNode
			| TagsNode
			| WorktreesNode,
		enabled: boolean,
	): Promise<void> {
		if (node instanceof BranchesNode) {
			return configuration.updateEffective(`views.${this.configKey}.showBranches` as const, enabled);
		}

		if (node instanceof BranchNode) {
			return configuration.updateEffective(`views.${this.configKey}.showCommits` as const, enabled);
		}

		if (node instanceof BranchTrackingStatusNode) {
			return configuration.updateEffective(`views.${this.configKey}.showUpstreamStatus` as const, enabled);
		}

		if (node instanceof CompareBranchNode) {
			return this.toggleSectionBranchComparison(enabled);
		}

		if (node instanceof ContributorsNode) {
			return configuration.updateEffective(`views.${this.configKey}.showContributors` as const, enabled);
		}

		if (node instanceof ReflogNode) {
			return configuration.updateEffective(`views.${this.configKey}.showIncomingActivity` as const, enabled);
		}

		if (node instanceof RemotesNode) {
			return configuration.updateEffective(`views.${this.configKey}.showRemotes` as const, enabled);
		}

		if (node instanceof StashesNode) {
			return configuration.updateEffective(`views.${this.configKey}.showStashes` as const, enabled);
		}

		if (node instanceof TagsNode) {
			return configuration.updateEffective(`views.${this.configKey}.showTags` as const, enabled);
		}

		if (node instanceof WorktreesNode) {
			return configuration.updateEffective(`views.${this.configKey}.showWorktrees` as const, enabled);
		}

		return Promise.resolve();
	}
}
