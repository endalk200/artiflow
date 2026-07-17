# Make V1 Deletion Permanent and Cascading

V1 deletion is permanent: deleting an Artifact removes all of its Revisions and stored source, deleting a Project cascades through all contained Artifacts, and deleted URLs return `404`. There is no trash, retention window, restore flow, or tombstone; interactive CLI deletion requires confirmation, automated deletion requires an explicit destructive flag, and the Artiflow Skill never deletes as part of publication.
